import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { hasCompleteReading, hasEnoughPoints, hasSuccessfulReading, toReadingSse } from './_reading-payment.js'

/**
 * POST /api/ai/reading
 *
 * Body: { prompt: string, type: 'single' | 'heban', mode: 'quick' | 'deep' }
 *
 * 鉴权：Authorization: Bearer <supabase-access-token>
 * 积分：确认获得有效解读正文后才扣除（quick=3, deep=9）
 * 输出：SSE（text/event-stream），兼容现有前端读取逻辑
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
  res.setHeader('Access-Control-Expose-Headers', 'X-Points-Balance')
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

  // ── 3. 积分校验 ──
  const cost = mode === 'deep' ? 9 : 3
  const pointsType = type === 'heban'
    ? (mode === 'deep' ? 'consume_heban' : 'consume_heban')
    : 'consume_ai'
  const desc = `${type === 'heban' ? '合盘' : '五行'}${mode === 'deep' ? '深度' : '快速'}解读`

  // 先只读校验余额。生成失败时不产生任何积分写入或流水。
  const { data: pointsAccount, error: balanceError } = await supabase
    .from('user_points')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  if (balanceError) {
    console.error('points balance lookup error:', balanceError)
    return res.status(500).json({ error: '积分状态读取失败，请重试' })
  }

  if (!hasEnoughPoints(pointsAccount?.balance, cost)) {
    return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: `积分不足，本次需要 ${cost} 积分` })
  }

  // ── 4. 调用 DeepSeek 并确认获得有效正文 ──
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
        stream: false,
      }),
    })

    if (!deepRes.ok) {
      const errText = await deepRes.text()
      console.error('DeepSeek stream error:', deepRes.status, errText)
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后重试' })
    }

    const payload = await deepRes.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content?.trim() ?? ''
    if (!hasSuccessfulReading(content)) {
      console.error('DeepSeek returned an empty reading')
      return res.status(502).json({ error: 'AI 未生成有效解读，请重试' })
    }
    if (!hasCompleteReading(content, type, mode)) {
      console.error('DeepSeek returned an incomplete deep reading', { type, mode })
      return res.status(502).json({ error: 'AI 未生成完整解读，请重试' })
    }

    // 只有有效正文准备返回时，才以原子方式扣除积分。
    // 若两个设备同时发起请求，其中一个会在这里因余额已变化而被安全拦截。
    const { data: remainingBalance, error: deductionError } = await supabase.rpc('consume_points_atomic', {
      p_user_id: user.id,
      p_amount: cost,
      p_type: pointsType,
      p_description: desc,
    })

    if (deductionError) {
      console.error('points deduction error:', deductionError)
      return res.status(500).json({ error: '积分扣除失败，请重试' })
    }
    if (remainingBalance === null) {
      return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: `积分不足，本次需要 ${cost} 积分` })
    }

    // 继续以 SSE 形式返回，前端无需改动。
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('X-Points-Balance', String(remainingBalance))
    res.write(toReadingSse(content))
    res.end()
  } catch (e) {
    console.error('reading handler error:', e)
    return res.status(500).json({ error: '服务异常，请稍后重试' })
  }
}
