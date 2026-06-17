import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/miniprogram-readings?uid=<supabase_user_id>
 *
 * 供微信小程序 WebView 免登录查看指定用户的历史测算记录。
 * 使用 service_role key 绕过 RLS，只返回必要的只读字段。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { data, error } = await supabase
    .from('readings')
    .select('id, name, birth_date, created_at, input_data, ai_report, is_primary')
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
