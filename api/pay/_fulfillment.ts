import type { SupabaseClient } from '@supabase/supabase-js'

export type PurchaseKind = 'membership' | 'points'

interface MembershipPlan {
  kind: 'membership'
  id: string
  label: string
  priceFen: number
  days: number
  bonusPoints: number
}

interface PointsPack {
  kind: 'points'
  id: string
  label: string
  priceFen: number
  points: number
}

export type PurchaseItem = MembershipPlan | PointsPack

export const MEMBERSHIP_PLANS: Record<string, MembershipPlan> = {
  trial:     { kind: 'membership', id: 'trial',     label: '7天试用会员', priceFen: 100,   days: 7,   bonusPoints: 1  },
  monthly:   { kind: 'membership', id: 'monthly',   label: '月度会员',   priceFen: 1800,  days: 30,  bonusPoints: 3  },
  quarterly: { kind: 'membership', id: 'quarterly', label: '季度会员',   priceFen: 4800,  days: 90,  bonusPoints: 8  },
  yearly:    { kind: 'membership', id: 'yearly',    label: '年度会员',   priceFen: 12800, days: 365, bonusPoints: 22 },
}

export const POINT_PACKS: Record<string, PointsPack> = {
  points_3:   { kind: 'points', id: 'points_3',   label: '3积分',   priceFen: 300,   points: 3   },
  points_8:   { kind: 'points', id: 'points_8',   label: '8积分',   priceFen: 700,   points: 8   },
  points_22:  { kind: 'points', id: 'points_22',  label: '22积分',  priceFen: 1800,  points: 22  },
  points_38:  { kind: 'points', id: 'points_38',  label: '38积分',  priceFen: 3000,  points: 38  },
  points_90:  { kind: 'points', id: 'points_90',  label: '90积分',  priceFen: 6800,  points: 90  },
  points_180: { kind: 'points', id: 'points_180', label: '180积分', priceFen: 12800, points: 180 },
}

export function getPurchaseItem(itemId: string): PurchaseItem | null {
  return MEMBERSHIP_PLANS[itemId] ?? POINT_PACKS[itemId] ?? null
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === '23505'
}

export function buildAttach(userId: string, item: PurchaseItem): string {
  // 微信支付 attach 限制为 128 字节。权益和价格都以服务端商品表为准，
  // 因而订单只需要携带不可伪造关联所需的用户 ID 与商品 ID。
  return JSON.stringify({
    u: userId,
    i: item.id,
  })
}

interface PaidOrder {
  outTradeNo: string
  tradeState: string
  amountFen?: number
  attach?: string
}

export interface FulfillmentResult {
  kind: PurchaseKind | null
  fulfilled: boolean
  isMember: boolean
  pointsCredited: boolean
  points: number
}

interface ParsedAttach {
  userId: string
  item: PurchaseItem
}

function parseAttach(raw: string | undefined): ParsedAttach {
  const attach = JSON.parse(raw ?? '{}') as {
    u?: string
    i?: string
    userId?: string
    kind?: PurchaseKind
    itemId?: string
    planId?: string
    days?: number
    points?: number
    priceFen?: number
  }

  const userId = attach.u ?? attach.userId ?? ''
  if (!userId) throw new Error('支付附加数据缺少 userId')

  const itemId = attach.i ?? attach.itemId ?? attach.planId ?? ''
  const catalogItem = itemId ? getPurchaseItem(itemId) : null
  if (catalogItem) return { userId, item: catalogItem }

  // 兼容早期会员订单 attach: { userId, planId, days }
  if (attach.planId && MEMBERSHIP_PLANS[attach.planId]) {
    return { userId, item: MEMBERSHIP_PLANS[attach.planId]! }
  }

  throw new Error('未知支付商品')
}

async function userHasActiveMembership(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  return !!data
}

async function fulfillMembership(
  supabase: SupabaseClient,
  userId: string,
  item: MembershipPlan,
  outTradeNo: string,
  amountFen: number | undefined,
): Promise<FulfillmentResult> {
  const { data: existing } = await supabase
    .from('memberships')
    .select('id')
    .eq('order_id', outTradeNo)
    .maybeSingle()

  if (!existing) {
    const { data: latest } = await supabase
      .from('memberships')
      .select('expires_at')
      .eq('user_id', userId)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date()
    const latestExpiry = latest?.expires_at ? new Date(latest.expires_at as string) : null
    const startsAt = latestExpiry && latestExpiry.getTime() > now.getTime() ? latestExpiry : now
    const expiresAt = new Date(startsAt.getTime() + item.days * 24 * 60 * 60 * 1000)

    const { error } = await supabase.from('memberships').insert({
      user_id: userId,
      plan: item.id,
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      order_id: outTradeNo,
      amount_fen: amountFen ?? item.priceFen,
    })

    if (error && !isUniqueViolation(error)) {
      throw new Error(`会员写入失败: ${error.message}`)
    }
  }

  await creditPointsForOrder(
    supabase,
    userId,
    item.bonusPoints,
    outTradeNo,
    'reward',
    `购买${item.label}赠送 ${item.bonusPoints} 积分`,
  )

  return {
    kind: 'membership',
    fulfilled: true,
    isMember: true,
    pointsCredited: item.bonusPoints > 0,
    points: item.bonusPoints,
  }
}

export async function creditPointsForOrder(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  outTradeNo: string,
  type: 'recharge' | 'reward',
  description: string,
): Promise<void> {
  if (points <= 0) return

  const { error } = await supabase.rpc('credit_points_once', {
    p_user_id: userId,
    p_amount: points,
    p_type: type,
    p_description: description,
    p_order_id: outTradeNo,
  })

  if (error) throw new Error(`积分发放失败: ${error.message}`)
}

async function fulfillPoints(
  supabase: SupabaseClient,
  userId: string,
  item: PointsPack,
  outTradeNo: string,
): Promise<FulfillmentResult> {
  await creditPointsForOrder(
    supabase,
    userId,
    item.points,
    outTradeNo,
    'recharge',
    `微信支付充值 ${item.points} 积分`,
  )

  return { kind: 'points', fulfilled: true, isMember: false, pointsCredited: true, points: item.points }
}

export async function fulfillPaidOrder(
  supabase: SupabaseClient,
  order: PaidOrder,
  expectedUserId?: string,
): Promise<FulfillmentResult> {
  if (order.tradeState !== 'SUCCESS') {
    return { kind: null, fulfilled: false, isMember: false, pointsCredited: false, points: 0 }
  }

  const { userId, item } = parseAttach(order.attach)
  if (expectedUserId && userId !== expectedUserId) {
    throw new Error('订单不属于当前用户')
  }

  if (typeof order.amountFen === 'number' && order.amountFen !== item.priceFen) {
    throw new Error('支付金额与商品价格不一致')
  }

  if (item.kind === 'membership') {
    return fulfillMembership(supabase, userId, item, order.outTradeNo, order.amountFen)
  }

  return fulfillPoints(supabase, userId, item, order.outTradeNo)
}

export async function getFulfillmentStateForUser(
  supabase: SupabaseClient,
  userId: string,
  outTradeNo: string,
): Promise<Pick<FulfillmentResult, 'isMember' | 'pointsCredited'>> {
  const [memberRes, pointsRes] = await Promise.all([
    userHasActiveMembership(supabase, userId),
    supabase
      .from('points_records')
      .select('id')
      .eq('user_id', userId)
      .eq('order_id', outTradeNo)
      .maybeSingle(),
  ])

  return {
    isMember: memberRes,
    pointsCredited: !!pointsRes.data,
  }
}
