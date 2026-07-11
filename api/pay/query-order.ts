import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getWxPayConfig, wxpayRequest } from './_wxpay.js'
import { fulfillPaidOrder, getFulfillmentStateForUser } from './_fulfillment.js'

/**
 * GET /api/pay/query-order?outTradeNo=xxx
 *
 * 前端轮询用：查询订单支付状态
 * 鉴权：Authorization: Bearer <token>
 *
 * 返回：{ tradeState: 'SUCCESS'|'NOTPAY'|'...' , isMember: boolean, pointsCredited: boolean }
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
    const result = await wxpayRequest<{
      trade_state: string
      attach?: string
      amount?: { total?: number }
    }>(
      'GET',
      `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchid}`,
    )

    const tradeState = result.trade_state
    let fulfillment = await getFulfillmentStateForUser(supabase, user.id, outTradeNo)
    let points = 0

    if (tradeState === 'SUCCESS') {
      const fulfilled = await fulfillPaidOrder(supabase, {
        outTradeNo,
        tradeState,
        amountFen: result.amount?.total,
        attach: result.attach,
      }, user.id)
      fulfillment = {
        isMember: fulfilled.isMember || fulfillment.isMember,
        pointsCredited: fulfilled.pointsCredited || fulfillment.pointsCredited,
      }
      points = fulfilled.points
    }

    return res.status(200).json({
      tradeState,
      isMember: fulfillment.isMember,
      pointsCredited: fulfillment.pointsCredited,
      points,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '查询失败'
    console.error('query-order error:', msg)
    return res.status(500).json({ error: msg })
  }
}
