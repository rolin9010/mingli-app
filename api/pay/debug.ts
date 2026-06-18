import type { VercelRequest, VercelResponse } from '@vercel/node'
import { normalizePem } from './_wxpay.js'
import { createSign } from 'crypto'

/**
 * GET /api/pay/debug
 * 诊断私钥格式，仅用于调试，上线前删除
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const raw = process.env.WX_PRIVATE_KEY ?? ''

  const info: Record<string, unknown> = {
    raw_length: raw.length,
    has_literal_backslash_n: raw.includes('\\n'),
    has_real_newline: raw.includes('\n'),
    starts_with_begin: raw.trimStart().startsWith('-----BEGIN'),
    first_50_chars: JSON.stringify(raw.slice(0, 50)),
    last_50_chars: JSON.stringify(raw.slice(-50)),
  }

  try {
    const pem = normalizePem(raw)
    info.normalized_length = pem.length
    info.normalized_first_80 = JSON.stringify(pem.slice(0, 80))
    info.normalized_last_80 = JSON.stringify(pem.slice(-80))

    // 尝试签名测试
    const testMsg = 'TEST\n1234567890\nNONCE\n\n'
    const sign = createSign('RSA-SHA256')
    sign.update(testMsg)
    const sig = sign.sign(pem, 'base64')
    info.sign_test = 'OK'
    info.sig_length = sig.length
  } catch (e: unknown) {
    info.normalize_error = e instanceof Error ? e.message : String(e)
  }

  return res.status(200).json(info)
}
