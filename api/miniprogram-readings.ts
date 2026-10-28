import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_OTP_TYPES = new Set(['magiclink', 'email'])

async function exchangeMiniProgramSession(req: VercelRequest, res: VercelResponse) {
  const tokenHash = typeof req.body?.token_hash === 'string' ? req.body.token_hash.trim() : ''
  const type = typeof req.body?.type === 'string' ? req.body.type : 'magiclink'
  if (!tokenHash || tokenHash.length > 512 || !ALLOWED_OTP_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid verification request' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token_hash: tokenHash, type }),
    })
  } catch (error) {
    console.error('miniprogram-session upstream error:', error instanceof Error ? error.message : error)
    return res.status(502).json({ error: 'Verification service unavailable' })
  }

  const payload = await upstream.json().catch(() => ({})) as {
    access_token?: string
    refresh_token?: string
    error?: string
    error_code?: string
  }
  if (!upstream.ok || !payload.access_token || !payload.refresh_token) {
    console.warn('miniprogram-session verify failed:', {
      status: upstream.status,
      errorCode: payload.error_code || payload.error || 'unknown',
    })
    return res.status(401).json({
      error: 'Verification failed',
      errorCode: payload.error_code || payload.error || 'unknown',
    })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })
}

/**
 * GET /api/miniprogram-readings?uid=<supabase_user_id>
 *
 * 供微信小程序 WebView 免登录查看指定用户的历史测算记录。
 * 使用 service_role key 绕过 RLS，只返回必要的只读字段。
 *
 * POST ?action=session
 * 在 WebView 同域内兑换 Supabase 一次性登录令牌，不额外占用 Vercel 函数配额。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST' && req.query.action === 'session') {
    return exchangeMiniProgramSession(req, res)
  }

  // 只允许 GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uid = typeof req.query.uid === 'string' ? req.query.uid.trim() : ''
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' })
  }

  // 简单 UUID 格式校验，防止注入
  if (!/^[0-9a-f-]{32,40}$/i.test(uid)) {
    return res.status(400).json({ error: 'Invalid uid format' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const readingId = typeof req.query.reading_id === 'string' ? req.query.reading_id.trim() : ''
  if (readingId) {
    if (!/^[0-9a-f-]{32,40}$/i.test(readingId)) {
      return res.status(400).json({ error: 'Invalid reading_id format' })
    }

    const { data, error } = await supabase
      .from('readings')
      .select('id,user_id,name,birth_date,created_at,input_data,ai_report,is_primary')
      .eq('user_id', uid)
      .eq('id', readingId)
      .maybeSingle()

    if (error) {
      console.error('miniprogram-reading detail error:', error)
      return res.status(500).json({ error: 'Database error' })
    }
    if (!data) return res.status(404).json({ error: 'Reading not found' })

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ reading: data })
  }

  // 列表只返回轻量摘要；完整 AI 解读按需单独加载，避免首屏传输多份大文本。
  const { data, error } = await supabase
    .from('readings')
    .select('id,name,birth_date,created_at,input_data,is_primary')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('miniprogram-readings error:', error)
    return res.status(500).json({ error: 'Database error' })
  }

  // CORS：允许 wuxingme.cn 访问
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ readings: data ?? [] })
}
