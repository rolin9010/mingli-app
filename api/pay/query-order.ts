import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getWxPayConfig, wxpayRequest } from './_wxpay'

/**
 * GET /api/pay/query-order?outTradeNo=xxx
 *
 * 前端轮询用：查询订单支付状态
 * 鉴权：Authorization: Bearer <token>
 *
 * 返回：{ tradeState: 'SUCCESS'|'NOTPAY'|'...' , isMember: boolean }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── 鉴权 ──
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '未登录' })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: '登录已失效' })

  const outTradeNo = typeof req.query.outTradeNo === 'string' ? req.query.outTradeNo.trim() : ''
  if (!outTradeNo) return res.status(400).json({ error: '缺少 outTradeNo' })

  try {
    const { mchid } = getWxPayConfig()

    // 查询微信侧订单状态
    const result = await wxpayRequest<{ trade_state: string }>(
      'GET',
      `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchid}`,
    )

    const tradeState = result.trade_state

    // 如果已支付，检查会员是否已写入
    let isMember = false
    if (tradeState === 'SUCCESS') {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .gt('expires_at', now)
        .maybeSingle()
      isMember = !!data
    }

    return res.status(200).json({ tradeState, isMember })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '查询失败'
    console.error('query-order error:', msg)
    return res.status(500).json({ error: msg })
  }
}
