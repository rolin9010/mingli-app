import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getWxPayConfig, decryptNotify } from './_wxpay.js'
import { fulfillPaidOrder } from './_fulfillment.js'

/**
 * POST /api/pay/notify
 *
 * 微信支付回调通知（仅 POST，微信服务器直接调用）
 * 1. 解密报文
 * 2. 验证订单状态 SUCCESS
 * 3. 写入会员记录或积分充值记录
 * 4. 返回 {"code":"SUCCESS"} 告知微信不再重试
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const { apiV3Key } = getWxPayConfig()

    // ── 1. 读取请求体 ──
    const body = req.body as {
      id?: string
      resource?: {
        algorithm?: string
        ciphertext?: string
        nonce?: string
        associated_data?: string
      }
      event_type?: string
    }

    if (body.event_type !== 'TRANSACTION.SUCCESS') {
      return res.status(200).json({ code: 'SUCCESS', message: '忽略非支付成功事件' })
    }

    const { ciphertext, nonce, associated_data } = body.resource ?? {}
    if (!ciphertext || !nonce) {
      return res.status(400).json({ code: 'FAIL', message: '缺少加密数据' })
    }

    // ── 2. 解密 ──
    let decrypted: string
    try {
      decrypted = decryptNotify(ciphertext, nonce, associated_data ?? '', apiV3Key)
    } catch (e) {
      console.error('notify decrypt error:', e)
      return res.status(400).json({ code: 'FAIL', message: '解密失败' })
    }

    const order = JSON.parse(decrypted) as {
      out_trade_no: string
      trade_state: string
      amount: { total: number }
      attach?: string
      transaction_id: string
    }

    if (order.trade_state !== 'SUCCESS') {
      return res.status(200).json({ code: 'SUCCESS', message: '非成功状态，忽略' })
    }

    await fulfillPaidOrder(supabase, {
      outTradeNo: order.out_trade_no,
      tradeState: order.trade_state,
      amountFen: order.amount.total,
      attach: order.attach,
    })

    console.log(`notify: 支付履约成功 outTradeNo=${order.out_trade_no}`)
    return res.status(200).json({ code: 'SUCCESS' })

  } catch (e) {
    console.error('notify handler error:', e)
    return res.status(500).json({ code: 'FAIL', message: '服务器内部错误' })
  }
}
