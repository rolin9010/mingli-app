import { createHmac } from 'crypto'
import { buildAttach, type PurchaseItem } from './_fulfillment.js'
import { genOutTradeNo } from './_wxpay.js'

const WECHAT_API_BASE = 'https://api.weixin.qq.com'

const VIRTUAL_PRODUCT_IDS: Record<string, string> = {
  trial: 'member_trial_7d',
  monthly: 'member_month_30d',
  quarterly: 'member_quarter_90d',
  yearly: 'member_year_365d',
}

const VIRTUAL_PAYMENT_PROXY_PREFIX = 'xpay'

export interface VirtualPaymentProxyRequest {
  action: 'createVirtualOrder' | 'confirmVirtualOrder'
  planId: string
  loginCode: string
  outTradeNo: string
}

export interface VirtualPayConfig {
  appId: string
  appSecret: string
  offerId: string
  env: 0 | 1
  appKey: string
}

interface MiniProgramSession {
  openid: string
  sessionKey: string
}

export interface VirtualPaymentOrder {
  order_id: string
  status: number
  order_fee: number
  paid_fee?: number
  wx_order_id?: string
  biz_meta?: string
}

interface AccessTokenCache {
  appId: string
  token: string
  expiresAt: number
}

let accessTokenCache: AccessTokenCache | null = null

function hmacSha256Hex(key: string, message: string): string {
  return createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`虚拟支付缺少环境变量 ${name}`)
  return value
}

export function getVirtualPayConfig(): VirtualPayConfig {
  const envValue = process.env.XPAY_ENV?.trim() ?? '0'
  if (envValue !== '0' && envValue !== '1') {
    throw new Error('XPAY_ENV 只能为 0 或 1')
  }

  const env = Number(envValue) as 0 | 1
  return {
    appId: process.env.WX_MINI_APPID?.trim() || 'wxf1d2e889d05100bb',
    appSecret: getRequiredEnv('WX_MINI_SECRET'),
    offerId: process.env.XPAY_OFFER_ID?.trim() || '1450606533',
    env,
    appKey: getRequiredEnv(env === 0 ? 'XPAY_APP_KEY' : 'XPAY_SANDBOX_APP_KEY'),
  }
}

export function getVirtualProductId(itemId: string): string {
  const productId = VIRTUAL_PRODUCT_IDS[itemId]
  if (!productId) throw new Error('该商品尚未配置虚拟支付道具')
  return productId
}

export function parseVirtualPaymentProxyPlanId(value: string): VirtualPaymentProxyRequest | null {
  const parts = value.split(':')
  if (parts.length !== 5 || parts[0] !== VIRTUAL_PAYMENT_PROXY_PREFIX) return null

  try {
    const action = decodeURIComponent(parts[1])
    const planId = decodeURIComponent(parts[2])
    const outTradeNo = decodeURIComponent(parts[3])
    const loginCode = decodeURIComponent(parts[4])
    if ((action !== 'create' && action !== 'confirm') || !planId || !loginCode) return null
    if (action === 'confirm' && !outTradeNo) return null
    return {
      action: action === 'create' ? 'createVirtualOrder' : 'confirmVirtualOrder',
      planId,
      loginCode,
      outTradeNo,
    }
  } catch {
    return null
  }
}

export function buildVirtualPaymentParams(
  userId: string,
  item: PurchaseItem,
  sessionKey: string,
  config: Pick<VirtualPayConfig, 'offerId' | 'env' | 'appKey'>,
  outTradeNo = genOutTradeNo(),
) {
  const signData = JSON.stringify({
    offerId: config.offerId,
    buyQuantity: 1,
    env: config.env,
    currencyType: 'CNY',
    productId: getVirtualProductId(item.id),
    goodsPrice: item.priceFen,
    outTradeNo,
    attach: buildAttach(userId, item),
  })

  return {
    outTradeNo,
    paymentParams: {
      mode: 'short_series_goods',
      signData,
      paySig: hmacSha256Hex(config.appKey, `requestVirtualPayment&${signData}`),
      signature: hmacSha256Hex(sessionKey, signData),
    },
  }
}

async function readWechatJson<T extends { errcode?: number; errmsg?: string }>(
  response: Response,
  fallbackError: string,
): Promise<T> {
  const text = await response.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    throw new Error(`${fallbackError}: 微信返回了无法识别的数据`)
  }

  if (!response.ok || (typeof data.errcode === 'number' && data.errcode !== 0)) {
    throw new Error(`${fallbackError}: ${data.errmsg || data.errcode || response.status}`)
  }
  return data
}

export async function exchangeMiniProgramLoginCode(
  code: string,
  config: Pick<VirtualPayConfig, 'appId' | 'appSecret'>,
): Promise<MiniProgramSession> {
  if (!code) throw new Error('缺少微信登录凭证')
  const query = new URLSearchParams({
    appid: config.appId,
    secret: config.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  })
  const response = await fetch(`${WECHAT_API_BASE}/sns/jscode2session?${query}`)
  const data = await readWechatJson<{
    errcode?: number
    errmsg?: string
    openid?: string
    session_key?: string
  }>(response, '微信登录校验失败')

  if (!data.openid || !data.session_key) {
    throw new Error('微信登录校验失败: 未返回用户登录态')
  }
  return { openid: data.openid, sessionKey: data.session_key }
}

async function getAccessToken(config: Pick<VirtualPayConfig, 'appId' | 'appSecret'>): Promise<string> {
  if (
    accessTokenCache
    && accessTokenCache.appId === config.appId
    && accessTokenCache.expiresAt > Date.now()
  ) {
    return accessTokenCache.token
  }

  const query = new URLSearchParams({
    grant_type: 'client_credential',
    appid: config.appId,
    secret: config.appSecret,
  })
  const response = await fetch(`${WECHAT_API_BASE}/cgi-bin/token?${query}`)
  const data = await readWechatJson<{
    errcode?: number
    errmsg?: string
    access_token?: string
    expires_in?: number
  }>(response, '微信接口凭证获取失败')

  if (!data.access_token) throw new Error('微信接口凭证获取失败: 未返回 access_token')
  accessTokenCache = {
    appId: config.appId,
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 300) * 1000,
  }
  return data.access_token
}

export async function queryVirtualPaymentOrder(
  openid: string,
  outTradeNo: string,
  config: VirtualPayConfig,
): Promise<VirtualPaymentOrder> {
  const accessToken = await getAccessToken(config)
  const body = JSON.stringify({
    openid,
    env: config.env,
    order_id: outTradeNo,
  })
  const paySig = hmacSha256Hex(config.appKey, `/xpay/query_order&${body}`)
  const query = new URLSearchParams({ access_token: accessToken, pay_sig: paySig })
  const response = await fetch(`${WECHAT_API_BASE}/xpay/query_order?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await readWechatJson<{
    errcode?: number
    errmsg?: string
    order?: VirtualPaymentOrder
  }>(response, '虚拟支付订单查询失败')

  if (!data.order) throw new Error('虚拟支付订单查询失败: 未返回订单')
  return data.order
}

export async function notifyVirtualGoodsProvided(
  outTradeNo: string,
  config: VirtualPayConfig,
): Promise<void> {
  const accessToken = await getAccessToken(config)
  const query = new URLSearchParams({ access_token: accessToken })
  const response = await fetch(`${WECHAT_API_BASE}/xpay/notify_provide_goods?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: outTradeNo,
      env: config.env,
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`虚拟道具发货确认失败: ${text || response.status}`)
  }
  if (text) {
    const data = JSON.parse(text) as { errcode?: number; errmsg?: string }
    if (typeof data.errcode === 'number' && data.errcode !== 0) {
      throw new Error(`虚拟道具发货确认失败: ${data.errmsg || data.errcode}`)
    }
  }
}
