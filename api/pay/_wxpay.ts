/**
 * 微信支付 APIv3 工具函数
 * 商户号：1600342350（直连模式）
 */

import { createSign, createVerify, createHash, createDecipheriv, randomBytes } from 'crypto'

// ── 环境变量读取 ────────────────────────────────────────────────────────────

export function getWxPayConfig() {
  const mchid = process.env.WX_MCHID
  const serialNo = process.env.WX_CERT_SERIAL_NO
  const privateKey = process.env.WX_PRIVATE_KEY
  const apiV3Key = process.env.WX_API_V3_KEY
  const notifyUrl = process.env.WX_NOTIFY_URL

  if (!mchid || !serialNo || !privateKey || !apiV3Key || !notifyUrl) {
    throw new Error('微信支付配置不完整，请检查环境变量')
  }

  return { mchid, serialNo, privateKey, apiV3Key, notifyUrl }
}

// ── 生成随机字符串 ────────────────────────────────────────────────────────

export function nonceStr(len = 32): string {
  return randomBytes(len).toString('hex').slice(0, len)
}

// ── 生成订单号 ─────────────────────────────────────────────────────────────
// 格式：时间戳(13位) + 随机(8位) = 21位，不超过微信32位限制

export function genOutTradeNo(): string {
  return `${Date.now()}${randomBytes(4).toString('hex')}`
}

// ── 构造签名字符串并签名 ──────────────────────────────────────────────────

export function buildSign(
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  body: string,
  privateKey: string,
): string {
  // 处理换行符：环境变量里的 \n 可能是字面量
  const pem = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey

  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`
  const sign = createSign('RSA-SHA256')
  sign.update(message)
  sign.end()
  return sign.sign(pem, 'base64')
}

// ── 构造 Authorization header ────────────────────────────────────────────

export function buildAuthHeader(
  method: string,
  urlPath: string,
  body: string,
  mchid: string,
  serialNo: string,
  privateKey: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = nonceStr()
  const signature = buildSign(method, urlPath, timestamp, nonce, body, privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`
}

// ── 调用微信支付 API ──────────────────────────────────────────────────────

const WXPAY_BASE = 'https://api.mch.weixin.qq.com'

export async function wxpayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: object,
): Promise<T> {
  const { mchid, serialNo, privateKey } = getWxPayConfig()
  const bodyStr = body ? JSON.stringify(body) : ''
  const auth = buildAuthHeader(method, path, bodyStr, mchid, serialNo, privateKey)

  const res = await fetch(`${WXPAY_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': auth,
      'User-Agent': 'wuxingme/1.0',
    },
    ...(bodyStr ? { body: bodyStr } : {}),
  })

  const text = await res.text()
  if (!res.ok) {
    let msg = `微信支付 API 错误 ${res.status}`
    try {
      const err = JSON.parse(text) as { message?: string; code?: string }
      msg = `${err.code ?? res.status}: ${err.message ?? text}`
    } catch { /* 静默 */ }
    throw new Error(msg)
  }

  return JSON.parse(text) as T
}

// ── AES-256-GCM 解密回调报文 ─────────────────────────────────────────────

export function decryptNotify(
  ciphertext: string,
  nonce: string,
  associatedData: string,
  apiV3Key: string,
): string {
  const keyBuf = Buffer.from(apiV3Key, 'utf8')
  const buf = Buffer.from(ciphertext, 'base64')
  const authTag = buf.slice(buf.length - 16)
  const data = buf.slice(0, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, nonce)
  decipher.setAuthTag(authTag)
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ── 验证回调签名 ─────────────────────────────────────────────────────────

export function verifyNotifySign(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  wxPublicKey: string,
): boolean {
  const message = `${timestamp}\n${nonce}\n${body}\n`
  const pem = wxPublicKey.includes('\\n')
    ? wxPublicKey.replace(/\\n/g, '\n')
    : wxPublicKey
  try {
    const verify = createVerify('RSA-SHA256')
    verify.update(message)
    return verify.verify(pem, signature, 'base64')
  } catch {
    return false
  }
}
