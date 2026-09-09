/**
 * 积分系统 - Supabase 持久化
 * 所有积分操作均读写 user_points（余额）和 points_records（流水）两张表
 */

import { supabase } from './supabase'

export interface PointsState {
  /** 当前积分余额 */
  balance: number
  /** 今日是否已签到 */
  checkedInToday: boolean
  /** 连续签到天数 */
  checkInStreak: number
  /** 积分记录（最近 50 条） */
  records: PointsRecord[]
}

export interface PointsRecord {
  id: string
  type: 'recharge' | 'checkin' | 'invite' | 'consume_ai' | 'consume_heban' | 'consume_daily' | 'reward'
  amount: number
  description: string
  createdAt: string
}

/** 查询邀请统计（邀请人数 + 累计获得积分） */
export async function getInviteStats(): Promise<{ count: number; totalPoints: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, totalPoints: 0 }

  const [invitesRes, pointsRes] = await Promise.all([
    supabase
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .eq('inviter_id', user.id),
    supabase
      .from('points_records')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'invite'),
  ])

  const count = invitesRes.count ?? 0
  const totalPoints = (pointsRes.data ?? []).reduce((sum, r) => sum + r.amount, 0)
  return { count, totalPoints }
}

/** 积分消耗常量 */
export const POINTS_COST = {
  AI_READING_QUICK: 3,    // AI 快速解读
  AI_READING_DEEP: 9,     // AI 深度解读
  HEBAN_READING_QUICK: 3, // 合盘快速解读
  HEBAN_READING_DEEP: 9,  // 合盘深度解读
  DAILY_TIP: 1,           // 每日贴士
} as const

/** 业务日统一按中国标准时间计算，避免 00:00-08:00 被 UTC 判成前一天。 */
export function getShanghaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const DEFAULT_STATE: PointsState = {
  balance: 0,
  checkedInToday: false,
  checkInStreak: 0,
  records: [],
}

/** 从 Supabase 加载积分状态（未登录返回默认值） */
export async function loadPointsState(): Promise<PointsState> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULT_STATE }

  // 并行查询余额和流水
  const [pointsRes, recordsRes] = await Promise.all([
    supabase
      .from('user_points')
      .select('balance, check_in_streak, last_check_in')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('points_records')
      .select('id, type, amount, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (pointsRes.error || !pointsRes.data) {
    throw new Error(pointsRes.error?.message ?? '积分账户不存在')
  }

  const { balance, check_in_streak, last_check_in } = pointsRes.data

  // 判断今日是否已签到
  const today = getShanghaiDateKey()
  const checkedInToday = last_check_in === today

  const records: PointsRecord[] = (recordsRes.data ?? []).map((r) => ({
    id: r.id,
    type: r.type as PointsRecord['type'],
    amount: r.amount,
    description: r.description,
    createdAt: r.created_at,
  }))

  return {
    balance,
    checkedInToday,
    checkInStreak: check_in_streak,
    records,
  }
}

/** 签到 —— 服务端原子操作：更新余额、streak、last_check_in，写流水 */
export async function checkIn(): Promise<{
  success: boolean
  reward: number
  newStreak: number
  newBalance: number
  alreadyChecked: boolean
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, reward: 0, newStreak: 0, newBalance: 0, alreadyChecked: false }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('登录已失效，请重新登录')

  const response = await fetch('/api/miniprogram-member', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'webPointsCheckIn' }),
  })
  const body = await response.json() as {
    success?: boolean
    reward?: number
    newStreak?: number
    newBalance?: number
    alreadyChecked?: boolean
    error?: string
  }
  if (!response.ok || !body.success) {
    throw new Error(body.error || '签到失败，请稍后重试')
  }

  return {
    success: true,
    reward: Number(body.reward ?? 0),
    newStreak: Number(body.newStreak ?? 0),
    newBalance: Number(body.newBalance ?? 0),
    alreadyChecked: body.alreadyChecked ?? Number(body.reward ?? 0) === 0,
  }
}
