import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Readable } from 'stream'
import { authorizeMiniProgramProxy } from './_miniprogram-auth.js'
import { userHasActiveMembership } from './_membership-access.js'
import {
  buildAttach,
  fulfillPaidOrder,
  getPurchaseEligibilityError,
  getPurchaseItem,
} from './pay/_fulfillment.js'
import { createMiniProgramOrder } from './pay/_miniprogram-order.js'
import {
  buildVirtualPaymentParams,
  exchangeMiniProgramLoginCode,
  getVirtualPayConfig,
  notifyVirtualGoodsProvided,
  parseVirtualPaymentProxyPlanId,
  queryVirtualPaymentOrder,
} from './pay/_virtual-payment.js'
import { get } from '@vercel/blob'
import { buildAudioStreamUrl, getRelaxAudioBlobPath, isFreeRelaxAudio, resolveRelaxAudioFile, verifyAudioSig } from './_signed.js'

// 音频签名地址有效期：默认 12 小时。
// 宽松一些是为了覆盖「暂停后再续播 / 循环播放 / 隔一段时间再回来」这些场景，
// 避免在会话中途因签名过期（403）而断播。
const AUDIO_URL_TTL_MS = Number(process.env.AUDIO_URL_TTL_MS || 12 * 60 * 60 * 1000)

export const config = { maxDuration: 60 }

async function handleAudioStream(req: VercelRequest, res: VercelResponse) {
  const fileId = String(req.query?.file || '')
  const exp = Number(req.query?.exp || 0)
  const sig = String(req.query?.sig || '')

  if (!fileId || !exp || !sig) return res.status(403).json({ error: 'MISSING' })
  if (Date.now() > exp) return res.status(403).json({ error: 'EXPIRED' })
  if (!verifyAudioSig(fileId, exp, sig)) return res.status(403).json({ error: 'BAD_SIG' })

  const pathname = getRelaxAudioBlobPath(fileId)
  if (!pathname) return res.status(404).json({ error: 'NOT_FOUND' })

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || ''
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined
    const options: { token: string; access: 'private'; headers?: Record<string, string> } = {
      token,
      access: 'private',
    }
    if (rangeHeader) options.headers = { Range: rangeHeader }

    // Forward the Range request to Blob so only the needed bytes are fetched,
    // then stream the response through instead of buffering the whole file.
    const result = await get(pathname, options)
    if (result.statusCode !== 200 || !result.stream) {
      return res.status(500).json({ error: '音频加载失败' })
    }

    const contentRange = result.headers?.get?.('content-range') || ''
    const contentLength = result.headers?.get?.('content-length') || ''
    const partial = !!rangeHeader && !!contentRange

    res.status(partial ? 206 : 200)
    res.setHeader('Content-Type', result.blob.contentType || 'audio/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-store')
    if (contentRange) res.setHeader('Content-Range', contentRange)
    if (contentLength) res.setHeader('Content-Length', contentLength)

    Readable.fromWeb(result.stream as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
  } catch (error) {
    console.error('[miniprogram] audio stream failed:', error)
    if (!res.headersSent) return res.status(500).json({ error: '音频加载失败' })
    return res.end()
  }
}

function getShanghaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

async function getPointsState(supabase: SupabaseClient<any>, userId: string) {
  const [accountRes, recordsRes] = await Promise.all([
    supabase
      .from('user_points')
      .select('balance,check_in_streak,last_check_in')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('points_records')
      .select('id,type,amount,description,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (accountRes.error || recordsRes.error) {
    throw new Error('积分状态查询失败')
  }

  const account = accountRes.data
  return {
    balance: Number(account?.balance ?? 0),
    checkedInToday: account?.last_check_in === getShanghaiDateKey(),
    checkInStreak: Number(account?.check_in_streak ?? 0),
    records: (recordsRes.data ?? []).map((record) => ({
      id: record.id,
      type: record.type,
      amount: Number(record.amount),
      description: record.description,
      createdAt: record.created_at,
    })),
  }
}

async function checkInForActiveMember(supabase: SupabaseClient<any>, userId: string) {
  if (!await userHasActiveMembership(supabase, userId)) {
    throw Object.assign(new Error('签到仅对有效松眠会员开放'), { statusCode: 403 })
  }

  const { data, error } = await supabase.rpc('check_in_points_for_user', {
    p_user_id: userId,
  })
  const result = data?.[0] as {
    reward?: number
    new_streak?: number
    new_balance?: number
    already_checked?: boolean
  } | undefined
  if (error || !result) {
    console.error('points check-in failed:', error)
    throw new Error('签到失败，请稍后重试')
  }

  return {
    reward: Number(result.reward ?? 0),
    newStreak: Number(result.new_streak ?? 0),
    newBalance: Number(result.new_balance ?? 0),
    alreadyChecked: !!result.already_checked,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' && req.query?.action === 'audio') {
    return handleAudioStream(req, res)
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: '服务器配置错误' })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  if (req.body?.action === 'webPointsCheckIn') {
    const authorization = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!token) return res.status(401).json({ error: '请先登录' })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: '登录已失效，请重新登录' })

    try {
      return res.status(200).json({
        success: true,
        ...await checkInForActiveMember(supabase, user.id),
      })
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? Number((error as Error & { statusCode: number }).statusCode)
        : 500
      return res.status(statusCode).json({
        error: error instanceof Error ? error.message : '签到失败，请稍后重试',
      })
    }
  }

  if (!await authorizeMiniProgramProxy(req, supabaseUrl, serviceKey)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const openid = typeof req.body?.openid === 'string' ? req.body.openid.trim() : ''
  const requestedAction = typeof req.body?.action === 'string' ? req.body.action : ''
  const requestedPlanId = typeof req.body?.planId === 'string' ? req.body.planId : ''
  const proxyRequest = requestedAction === 'createOrder'
    ? parseVirtualPaymentProxyPlanId(requestedPlanId)
    : null
  const action = (proxyRequest?.action ?? requestedAction) || 'status'
  if (!openid) return res.status(400).json({ error: 'Missing openid' })

  const { data: binding, error: bindingError } = await supabase
    .from('user_bindings')
    .select('user_id')
    .eq('wechat_openid', openid)
    .maybeSingle()

  if (bindingError) return res.status(500).json({ error: '账号关联查询失败' })
  if (!binding?.user_id) {
    if (action === 'status' || action === 'pointsStatus') {
      return res.status(200).json({
        success: true,
        isMember: false,
        balance: 0,
        checkedInToday: false,
        checkInStreak: 0,
        records: [],
        hasUsedTrial: false,
        needsBinding: true,
      })
    }
    // 免费试听：未绑定/未登录用户也可获取免费曲的播放地址
    if (action === 'audioUrl') {
      const freeAudioId = typeof req.body?.audioId === 'string' ? req.body.audioId.trim() : ''
      if (resolveRelaxAudioFile(freeAudioId) && isFreeRelaxAudio(freeAudioId)) {
        const exp = Date.now() + AUDIO_URL_TTL_MS
        return res.status(200).json({ success: true, url: buildAudioStreamUrl(freeAudioId, exp) })
      }
    }
    return res.status(409).json({ error: '请先开通或关联元气文化账号' })
  }

  if (action === 'pointsStatus') {
    try {
      return res.status(200).json({
        success: true,
        needsBinding: false,
        ...await getPointsState(supabase, binding.user_id),
      })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : '积分状态查询失败' })
    }
  }

  if (action === 'pointsCheckIn') {
    try {
      const checkInResult = await checkInForActiveMember(supabase, binding.user_id)
      return res.status(200).json({
        success: true,
        needsBinding: false,
        ...checkInResult,
        ...await getPointsState(supabase, binding.user_id),
      })
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? Number((error as Error & { statusCode: number }).statusCode)
        : 500
      return res.status(statusCode).json({
        error: error instanceof Error ? error.message : '签到失败，请稍后重试',
      })
    }
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('plan,expires_at')
    .eq('user_id', binding.user_id)
    .order('expires_at', { ascending: false })

  if (membershipError) return res.status(500).json({ error: '会员状态查询失败' })

  const now = Date.now()
  const rows = memberships ?? []
  const active = rows.find((row) => Date.parse(row.expires_at) > now)
  const hasUsedTrial = rows.some((row) => row.plan === 'trial')

  if (action === 'status') {
    return res.status(200).json({
      success: true,
      isMember: !!active,
      plan: active?.plan ?? null,
      expireAt: active?.expires_at ?? null,
      hasUsedTrial,
      needsBinding: false,
    })
  }

  if (action === 'audioUrl') {
    const audioId = typeof req.body?.audioId === 'string' ? req.body.audioId.trim() : ''
    if (!resolveRelaxAudioFile(audioId)) return res.status(400).json({ error: '无效音频' })
    if (!active && !isFreeRelaxAudio(audioId)) {
      return res.status(403).json({ error: '需开通松眠会员才能畅听放松音频' })
    }
    const exp = Date.now() + AUDIO_URL_TTL_MS
    return res.status(200).json({ success: true, url: buildAudioStreamUrl(audioId, exp) })
  }

  const planId = proxyRequest?.planId ?? requestedPlanId
  const item = getPurchaseItem(planId)
  if (!item || item.kind !== 'membership') return res.status(400).json({ error: '无效会员套餐' })

  if (action === 'createOrder' || action === 'createVirtualOrder') {
    const eligibilityError = getPurchaseEligibilityError(item, hasUsedTrial)
    if (eligibilityError) return res.status(409).json({ error: eligibilityError })
  }

  try {
    if (action === 'createOrder') {
      const order = await createMiniProgramOrder(binding.user_id, openid, item)
      return res.status(200).json({ success: true, ...order })
    }

    const loginCode = proxyRequest?.loginCode
      ?? (typeof req.body?.loginCode === 'string' ? req.body.loginCode.trim() : '')
    const config = getVirtualPayConfig()
    const session = await exchangeMiniProgramLoginCode(loginCode, config)
    if (session.openid !== openid) {
      return res.status(403).json({ error: '微信登录身份与当前账号不一致' })
    }

    if (action === 'createVirtualOrder') {
      const order = buildVirtualPaymentParams(
        binding.user_id,
        item,
        session.sessionKey,
        config,
      )
      return res.status(200).json({ success: true, ...order })
    }

    const outTradeNo = proxyRequest?.outTradeNo
      ?? (typeof req.body?.outTradeNo === 'string' ? req.body.outTradeNo.trim() : '')
    if (!/^[A-Za-z0-9_|*@-]{8,32}$/.test(outTradeNo) || outTradeNo.startsWith('_')) {
      return res.status(400).json({ error: '无效虚拟支付订单号' })
    }

    const order = await queryVirtualPaymentOrder(openid, outTradeNo, config)
    if (order.order_id !== outTradeNo) {
      return res.status(409).json({ error: '微信返回的订单号不一致' })
    }
    if (order.order_fee !== item.priceFen) {
      return res.status(409).json({ error: '支付金额与会员套餐不一致' })
    }

    if (![2, 3, 4].includes(order.status)) {
      return res.status(200).json({
        success: true,
        fulfilled: false,
        paid: false,
        orderStatus: order.status,
      })
    }

    const fulfillment = await fulfillPaidOrder(supabase, {
      outTradeNo,
      tradeState: 'SUCCESS',
      amountFen: order.order_fee,
      attach: buildAttach(binding.user_id, item),
    }, binding.user_id)

    if (order.status !== 4) {
      try {
        await notifyVirtualGoodsProvided(outTradeNo, config)
      } catch (error) {
        console.error('virtual goods delivery acknowledgement failed:', error)
      }
    }

    return res.status(200).json({
      success: true,
      paid: true,
      fulfilled: fulfillment.fulfilled,
      isMember: fulfillment.isMember,
      pointsCredited: fulfillment.pointsCredited,
      points: fulfillment.points,
      orderStatus: order.status,
    })
  } catch (error) {
    console.error('miniprogram member order failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : '下单失败' })
  }
}
