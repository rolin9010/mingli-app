import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { creditPointsForOrder } from './_fulfillment.js'
import { getWxPayConfig, wxpayRequest } from './_wxpay.js'

const SONGMIAN_MONTHLY_PRICE_FEN = 1
const SONGMIAN_MONTHLY_BONUS_POINTS = 3

interface WechatOrder {
  appid?: string
  trade_state: string
  trade_type?: string
  description?: string
  payer?: { openid?: string }
  amount?: { total?: number }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const outTradeNo = typeof req.body?.outTradeNo === 'string' ? req.body.outTradeNo.trim() : ''
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(outTradeNo)) {
    return res.status(400).json({ error: '无效订单号' })
  }

  try {
    const { mchid } = getWxPayConfig()
    const order = await wxpayRequest<WechatOrder>(
      'GET',
      `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchid}`,
    )

    const expectedAppid = process.env.WX_MINI_APPID ?? 'wxf1d2e889d05100bb'
    const openid = order.payer?.openid ?? ''
    const isSongmianOrder = order.appid === expectedAppid
      && order.trade_state === 'SUCCESS'
      && order.trade_type === 'JSAPI'
      && order.amount?.total === SONGMIAN_MONTHLY_PRICE_FEN
      && order.description?.includes('松眠')

    if (!isSongmianOrder || !openid) {
      return res.status(409).json({ error: '订单未支付或不属于松眠会员' })
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } },
    )

    const { data: binding, error: bindingError } = await supabase
      .from('user_bindings')
      .select('user_id')
      .eq('wechat_openid', openid)
      .maybeSingle()

    if (bindingError) throw new Error(`绑定关系查询失败: ${bindingError.message}`)
    if (!binding?.user_id) {
      return res.status(409).json({ error: '请先绑定 wuxingme 账号后领取积分' })
    }

    await creditPointsForOrder(
      supabase,
      binding.user_id as string,
      SONGMIAN_MONTHLY_BONUS_POINTS,
      `songmian:${outTradeNo}`,
      'reward',
      '开通松眠月度会员赠送 3 积分',
    )

    return res.status(200).json({ success: true, points: SONGMIAN_MONTHLY_BONUS_POINTS })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '积分发放失败'
    console.error('miniprogram-bonus error:', message)
    return res.status(500).json({ error: message })
  }
}
