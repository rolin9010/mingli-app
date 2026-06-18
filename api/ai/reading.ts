import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/ai/reading
 *
 * Body: { prompt: string, type: 'single' | 'heban', mode: 'quick' | 'deep' }
 *
 * 鉴权：Authorization: Bearer <supabase-access-token>
 * 积分：调用前先扣积分（quick=3, deep=9）
 * 流式输出：SSE（text/event-stream）
 */

const MAX_TOKENS: Record<string, number> = {
  single_quick: 2500,
  single_deep: 8000,
  heban_quick: 2000,
  heban_deep: 6000,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── 1. 鉴权 ──
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ error: '未登录' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!supabaseUrl || !serviceKey || !deepseekKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '登录已失效，请重新登录' })

  // ── 2. 解析参数 ──
  const {
    prompt,
    type = 'single',
    mode = 'quick',
    systemPrompt,
  } = req.body as {
    prompt?: string
    type?: 'single' | 'heban'
    mode?: 'quick' | 'deep'
    systemPrompt?: string
  }

  if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
    return res.status(400).json({ error: '参数错误' })
  }

  // ── 3. 积分扣除 ──
  const cost = mode === 'deep' ? 9 : 3
  const pointsType = type === 'heban'
    ? (mode === 'deep' ? 'consume_heban' : 'consume_heban')
    : 'consume_ai'
  const desc = `${type === 'heban' ? '合盘' : '五行'}${mode === 'deep' ? '深度' : '快速'}解读`

  // 读取余额
  const { data: pointsData } = await supabase
    .from('user_points')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (!pointsData || pointsData.balance < cost) {
    return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: `积分不足，本次需要 ${cost} 积分` })
  }

  // 原子扣减
  const [updateRes, insertRes] = await Promise.all([
    supabase.from('user_points').update({
      balance: pointsData.balance - cost,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id),
    supabase.from('points_records').insert({
      user_id: user.id,
      type: pointsType,
      amount: -cost,
      description: desc,
    }),
  ])

  if (updateRes.error || insertRes.error) {
    console.error('points deduction error:', updateRes.error, insertRes.error)
    return res.status(500).json({ error: '积分扣除失败，请重试' })
  }

  // ── 4. 流式调用 DeepSeek ──
  const maxTokens = MAX_TOKENS[`${type}_${mode}`] ?? 4000

  try {
    const deepRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.85,
        max_tokens: maxTokens,
        stream: true,
      }),
    })

    if (!deepRes.ok) {
      const errText = await deepRes.text()
      console.error('DeepSeek stream error:', deepRes.status, errText)
      // 退款
      await supabase.from('user_points').update({
        balance: pointsData.balance,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
      return res.status(502).json({ error: 'AI 服务暂时不可用，积分已退回' })
    }

    // SSE 流式输出
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')

    const reader = deepRes.body?.getReader()
    if (!reader) return res.status(500).end()

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      // 直接透传 SSE chunks
      res.write(chunk)
    }

    res.end()
  } catch (e) {
    console.error('reading handler error:', e)
    // 尝试退款
    try {
      await supabase.from('user_points').update({
        balance: pointsData.balance,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
    } catch { /* 静默 */ }
    return res.status(500).json({ error: '服务异常，积分已退回' })
  }
}
