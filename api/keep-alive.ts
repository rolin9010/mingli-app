import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/keep-alive
 *
 * 定时 ping Supabase，防止免费版数据库因不活跃而休眠（7天无请求会暂停）。
 * 由 vercel.json 的 crons 配置每天自动调用一次。
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'missing env' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 做一次极轻量的查询，只需唤醒数据库即可
  const { error } = await supabase.from('readings').select('id').limit(1)

  if (error) {
    console.error('keep-alive ping failed:', error.message)
    return res.status(500).json({ ok: false, error: error.message })
  }

  const ts = new Date().toISOString()
  console.log(`keep-alive ping ok at ${ts}`)
  return res.status(200).json({ ok: true, ts })
}
