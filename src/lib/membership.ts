/**
 * 会员状态查询
 * 读取 memberships 表，判断当前用户是否有有效会员
 */

import { supabase } from './supabase'

export interface MembershipInfo {
  isMember: boolean
  plan: string | null       // 'trial' | 'monthly' | 'quarterly' | 'yearly'
  expiresAt: Date | null
  /** 距到期剩余天数（非会员为 null） */
  daysLeft: number | null
}

const CACHE_KEY = 'membership_cache'
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 分钟内不重复请求

interface CacheEntry {
  info: MembershipInfo
  cachedAt: number
}

function readCache(): MembershipInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null
    // 还原 Date 对象
    return {
      ...entry.info,
      expiresAt: entry.info.expiresAt ? new Date(entry.info.expiresAt) : null,
    }
  } catch {
    return null
  }
}

function writeCache(info: MembershipInfo): void {
  try {
    const entry: CacheEntry = { info, cachedAt: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch { /* 静默 */ }
}

export function clearMembershipCache(): void {
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* 静默 */ }
}

/** 查询当前登录用户的会员状态，带 5 分钟本地缓存 */
export async function getMembershipInfo(forceRefresh = false): Promise<MembershipInfo> {
  const NOT_MEMBER: MembershipInfo = { isMember: false, plan: null, expiresAt: null, daysLeft: null }

  if (!forceRefresh) {
    const cached = readCache()
    if (cached) return cached
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NOT_MEMBER

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('memberships')
    .select('plan, expires_at')
    .eq('user_id', user.id)
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    writeCache(NOT_MEMBER)
    return NOT_MEMBER
  }

  const expiresAt = new Date(data.expires_at as string)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  const info: MembershipInfo = {
    isMember: true,
    plan: data.plan as string,
    expiresAt,
    daysLeft,
  }
  writeCache(info)
  return info
}

/** 获取当前用户的 Supabase access token（用于调服务端 API） */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** 会员套餐配置（用于展示购买选项） */
export const MEMBERSHIP_PLANS = [
  {
    id: 'trial',
    label: '7天试用',
    price: '¥0.01',
    priceFen: 1,            // 单位：分
    duration: 7,            // 天
    bonusPoints: 1,
    badge: '新人专享',
    highlight: true,
  },
  {
    id: 'monthly',
    label: '月度会员',
    price: '¥18',
    priceFen: 1800,
    duration: 30,
    bonusPoints: 3,
    badge: null,
    highlight: false,
  },
  {
    id: 'quarterly',
    label: '季度会员',
    price: '¥48',
    priceFen: 4800,
    duration: 90,
    bonusPoints: 8,
    badge: '推荐',
    highlight: false,
  },
  {
    id: 'yearly',
    label: '年度会员',
    price: '¥128',
    priceFen: 12800,
    duration: 365,
    bonusPoints: 22,
    badge: '最划算',
    highlight: false,
  },
] as const

export type PlanId = (typeof MEMBERSHIP_PLANS)[number]['id']
