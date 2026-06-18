import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/ai/daily-tip
 *
 * Body: { prompt: string, userId: string }
 *
 * 鉴权：验证 Authorization: Bearer <supabase-access-token>
 * 会员校验：查 memberships 表，有效期内才调 DeepSeek
 */

const DAILY_TIP_SYSTEM_PROMPT = `你是一位精通中国传统命理学（四柱八字）与阴阳五行养生的导师。
每天根据用户的五行格局与当日天干地支，给出一条简短、温暖、实用的养生/能量贴士。

要求：
1. 只输出一条贴士，字数在 60-120 字之间，语言亲切口语化，像朋友发的一条暖心消息。
2. 内容必须结合用户的具体五行旺衰（引用具体百分比数字）+ 今日干支能量，给出今天特别适合做的 1 件具体事情。
3. 末尾附一个对应五行的 Emoji（木🌿 火🔥 土🌍 金✨ 水💧），只用一个。
4. 不出现标题、不分段，直接输出正文。
5. 禁止出现紫微斗数、星盘、MBTI、血型等非五行内容。`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── 1. 鉴权：从 Authorization header 拿 token ──
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ error: '未登录' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!supabaseUrl || !serviceKey || !deepseekKey) {
    console.error('Missing env vars:', { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey, deepseekKey: !!deepseekKey })
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 用 token 验证用户身份
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '登录已失效，请重新登录' })

  // ── 2. 会员校验 ──
  const now = new Date().toISOString()
  const { data: membership } = await supabase
    .from('memberships')
    .select('expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return res.status(403).json({ error: 'NOT_MEMBER', message: '需要开通会员才能使用每日专属贴士' })
  }

  // ── 3. 拿 prompt ──
  const { prompt } = req.body as { prompt?: string }
  if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
    return res.status(400).json({ error: '参数错误' })
  }

  // ── 4. 调 DeepSeek ──
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
          { role: 'system', content: DAILY_TIP_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 300,
      }),
    })

    const text = await deepRes.text()
    if (!deepRes.ok) {
      console.error('DeepSeek error:', deepRes.status, text)
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后重试' })
    }

    const data = JSON.parse(text) as { choices: { message: { content: string } }[] }
    const tip = data.choices[0]?.message?.content ?? ''

    return res.status(200).json({ tip, expiresAt: membership.expires_at })
  } catch (e) {
    console.error('daily-tip handler error:', e)
    return res.status(500).json({ error: '服务异常，请稍后重试' })
  }
}
