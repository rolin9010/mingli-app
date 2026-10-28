import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_TYPES = new Set(['magiclink', 'email'])

type SupabaseVerifyResponse = {
  access_token?: string
  refresh_token?: string
  error?: string
  error_code?: string
  msg?: string
}

/**
 * 在小程序 WebView 的同域内兑换 Supabase 一次性登录令牌。
 * 避免 WebView 直接跨域请求 Supabase Auth 时因网络策略或预加载导致令牌失效。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tokenHash = typeof req.body?.token_hash === 'string' ? req.body.token_hash.trim() : ''
  const type = typeof req.body?.type === 'string' ? req.body.type : 'magiclink'
  if (!tokenHash || tokenHash.length > 512 || !ALLOWED_TYPES.has(type)) {
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

  const payload = await upstream.json().catch(() => ({})) as SupabaseVerifyResponse
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
