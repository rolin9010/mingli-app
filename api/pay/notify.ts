import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getWxPayConfig, decryptNotify } from './_wxpay.js'

/**
 * POST /api/pay/notify
 *
 * 微信支付回调通知（仅 POST，微信服务器直接调用）
 * 1. 解密报文
 * 2. 验证订单状态 SUCCESS
 * 3. 在 memberships 表写入会员记录
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

    // ── 3. 解析 attach（userId + planId + days）──
    let userId: string
    let planId: string
    let days: number

    try {
      const attach = JSON.parse(order.attach ?? '{}') as {
        userId?: string
        planId?: string
        days?: number
      }
      userId = attach.userId ?? ''
      planId = attach.planId ?? 'trial'
      days = attach.days ?? 7
    } catch {
      console.error('notify: attach parse error', order.attach)
      return res.status(400).json({ code: 'FAIL', message: 'attach 解析失败' })
    }

    if (!userId) {
      return res.status(400).json({ code: 'FAIL', message: '缺少 userId' })
    }

    // ── 4. 幂等检查：同一 out_trade_no 只处理一次 ──
    const { data: existing } = await supabase
      .from('memberships')
      .select('id')
      .eq('order_id', order.out_trade_no)
      .maybeSingle()

    if (existing) {
      console.log('notify: 重复回调，已忽略', order.out_trade_no)
      return res.status(200).json({ code: 'SUCCESS', message: '已处理' })
    }

    // ── 5. 写入会员记录 ──
    const now = new Date()
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { error: insertErr } = await supabase.from('memberships').insert({
      user_id: userId,
      plan: planId,
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      order_id: order.out_trade_no,
      amount_fen: order.amount.total,
    })

    if (insertErr) {
      console.error('notify: insert membership error:', insertErr)
      // 返回 FAIL 让微信重试
      return res.status(500).json({ code: 'FAIL', message: '数据库写入失败' })
    }

    console.log(`notify: 会员开通成功 userId=${userId} plan=${planId} expires=${expiresAt.toISOString()}`)
    return res.status(200).json({ code: 'SUCCESS' })

  } catch (e) {
    console.error('notify handler error:', e)
    return res.status(500).json({ code: 'FAIL', message: '服务器内部错误' })
  }
}
