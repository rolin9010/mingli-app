import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createSign } from 'crypto'
import { getWxPayConfig, wxpayRequest, genOutTradeNo, normalizePem } from './_wxpay.js'
import { buildAttach, getPurchaseEligibilityError, getPurchaseItem } from './_fulfillment.js'

/**
 * POST /api/pay/create-order
 *
 * Body: { planId/itemId: string, payType: 'native'|'h5'|'jsapi', openid?: string }
 *
 * 鉴权：Authorization: Bearer <supabase-access-token>
 *
 * 返回：
 *  native  → { outTradeNo, codeUrl }         （前端展示二维码）
 *  h5      → { outTradeNo, h5Url }            （前端跳转 h5Url）
 *  jsapi   → { outTradeNo, jsapiParams }      （小程序调 wx.requestPayment）
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── 1. 鉴权 ──
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '未登录' })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: '登录已失效' })

  // ── 2. 参数 ──
  const { planId, itemId, payType, openid } = req.body as {
    planId?: string
    itemId?: string
    payType?: 'native' | 'h5' | 'jsapi'
    openid?: string
  }

  const purchaseId = itemId ?? planId ?? ''
  const item = getPurchaseItem(purchaseId)
  if (!item) return res.status(400).json({ error: '无效商品' })
  if (!payType || !['native', 'h5', 'jsapi'].includes(payType)) return res.status(400).json({ error: '无效支付类型' })
  if (payType === 'jsapi' && !openid) return res.status(400).json({ error: 'JSAPI 支付需要 openid' })

  if (item.kind === 'membership' && item.id === 'trial') {
    const { data: usedTrial, error: eligibilityError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan', 'trial')
      .limit(1)
      .maybeSingle()

    if (eligibilityError) {
      console.error('trial eligibility check error:', eligibilityError.message)
      return res.status(500).json({ error: '暂时无法确认试用资格，请稍后重试' })
    }

    const purchaseEligibilityError = getPurchaseEligibilityError(item, !!usedTrial)
    if (purchaseEligibilityError) {
      return res.status(409).json({ error: purchaseEligibilityError })
    }
  }

  const { mchid, notifyUrl } = getWxPayConfig()
  const outTradeNo = genOutTradeNo()
  const attach = buildAttach(user.id, item)

  // ── 3. 调微信下单 ──
  try {
    if (payType === 'native') {
      // Native 支付（生成二维码）
      const result = await wxpayRequest<{ code_url: string }>('POST', '/v3/pay/transactions/native', {
        appid: process.env.WX_APPID ?? 'wxce6d9e5883f89cb7',
        mchid,
        description: `五行明理 - ${item.label}`,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total: item.priceFen, currency: 'CNY' },
        attach,
      })

      return res.status(200).json({ outTradeNo, codeUrl: result.code_url })

    } else if (payType === 'h5') {
      // H5 支付（微信外浏览器）
      const result = await wxpayRequest<{ h5_url: string }>('POST', '/v3/pay/transactions/h5', {
        appid: process.env.WX_APPID ?? 'wxce6d9e5883f89cb7',
        mchid,
        description: `五行明理 - ${item.label}`,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total: item.priceFen, currency: 'CNY' },
        scene_info: {
          payer_client_ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? '127.0.0.1',
          h5_info: { type: 'Wap', app_name: '五行明理', app_url: 'https://wuxingme.cn' },
        },
        attach,
      })

      return res.status(200).json({ outTradeNo, h5Url: result.h5_url })

    } else {
      // JSAPI 支付（小程序）
      const result = await wxpayRequest<{ prepay_id: string }>('POST', '/v3/pay/transactions/jsapi', {
        appid: process.env.WX_MINI_APPID ?? 'wxf1d2e889d05100bb',
        mchid,
        description: `五行明理 - ${item.label}`,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total: item.priceFen, currency: 'CNY' },
        payer: { openid },
        attach,
      })

      // 构造小程序调起支付所需参数
      const { privateKey } = getWxPayConfig()
      const appId = process.env.WX_MINI_APPID ?? 'wxf1d2e889d05100bb'
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const nonce = Math.random().toString(36).slice(2, 18)
      const prepayId = `prepay_id=${result.prepay_id}`
      const signStr = `${appId}\n${timestamp}\n${nonce}\n${prepayId}\n`
      const pem = normalizePem(privateKey)
      const signer = createSign('RSA-SHA256')
      signer.update(signStr)
      const paySign = signer.sign(pem, 'base64')

      return res.status(200).json({
        outTradeNo,
        jsapiParams: {
          timeStamp: timestamp,
          nonceStr: nonce,
          package: prepayId,
          signType: 'RSA',
          paySign,
        },
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '下单失败'
    console.error('create-order error:', msg)
    return res.status(500).json({ error: msg })
  }
}
