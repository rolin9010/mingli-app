import type { VercelRequest, VercelResponse } from '@vercel/node'
import { normalizePem } from './_wxpay.js'
import { createSign, randomBytes } from 'crypto'

/**
 * GET /api/pay/debug
 * 诊断：直接向微信发一个查询请求，返回完整响应
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const raw = process.env.WX_PRIVATE_KEY ?? ''
  const mchid = process.env.WX_MCHID ?? ''
  const serialNo = process.env.WX_CERT_SERIAL_NO ?? ''

  const notifyUrl = process.env.WX_NOTIFY_URL ?? '(未设置)'
  const info: Record<string, unknown> = {
    mchid,
    serialNo,
    serialNo_length: serialNo.length,
    env_serialNo: process.env.WX_CERT_SERIAL_NO ?? '(未设置)',
    notify_url_raw: JSON.stringify(notifyUrl),
    notify_url_length: notifyUrl.length,
    deploy_time: new Date().toISOString(),
    key_ok: false,
  }

  try {
    const pem = normalizePem(raw)
    info.key_ok = true

    // 用一个简单的 GET 请求测试签名（查询商户证书列表）
    const method = 'GET'
    const path = '/v3/certificates'
    const bodyStr = ''
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const signMessage = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyStr}\n`

    info.signMessage = signMessage

    const signer = createSign('RSA-SHA256')
    signer.update(signMessage)
    signer.end()
    const signature = signer.sign(pem, 'base64')

    const auth = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`
    info.auth_prefix = auth.slice(0, 150)

    const wxRes = await fetch('https://api.mch.weixin.qq.com/v3/certificates', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'zh-CN',
        'Authorization': auth,
        'User-Agent': 'wuxingme/1.0',
      },
    })

    const text = await wxRes.text()
    info.wx_status = wxRes.status
    info.wx_response = text.slice(0, 500)

  } catch (e: unknown) {
    info.error = e instanceof Error ? e.message : String(e)
  }

  return res.status(200).json(info)
}
