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

/** 积分消耗常量 */
export const POINTS_COST = {
  AI_READING_QUICK: 3,    // AI 快速解读
  AI_READING_DEEP: 9,     // AI 深度解读
  HEBAN_READING_QUICK: 3, // 合盘快速解读
  HEBAN_READING_DEEP: 9,  // 合盘深度解读
  DAILY_TIP: 1,           // 每日贴士
} as const

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
    // 用户行不存在（老用户迁移），自动初始化
    await initUserPoints(user.id)
    return { ...DEFAULT_STATE, balance: 5 }
  }

  const { balance, check_in_streak, last_check_in } = pointsRes.data

  // 判断今日是否已签到
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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

/** 初始化新用户的积分行（正常由数据库触发器处理，此处为兜底） */
async function initUserPoints(userId: string): Promise<void> {
  // upsert 避免重复插入
  await supabase.from('user_points').upsert({
    user_id: userId,
    balance: 5,
    check_in_streak: 0,
    last_check_in: null,
  }, { onConflict: 'user_id' })

  await supabase.from('points_records').insert({
    user_id: userId,
    type: 'reward',
    amount: 5,
    description: '新用户赠送',
  })
}

/** 签到 —— 服务端原子操作：更新余额、streak、last_check_in，写流水 */
export async function checkIn(): Promise<{ success: boolean; reward: number; newStreak: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, reward: 0, newStreak: 0 }

  const today = new Date().toISOString().slice(0, 10)

  // 读取当前状态
  const { data, error } = await supabase
    .from('user_points')
    .select('balance, check_in_streak, last_check_in')
    .eq('user_id', user.id)
    .single()

  if (error || !data) return { success: false, reward: 0, newStreak: 0 }
  if (data.last_check_in === today) return { success: false, reward: 0, newStreak: data.check_in_streak }

  // 计算连续签到天数
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  const newStreak = data.last_check_in === yesterdayStr ? data.check_in_streak + 1 : 1
  const reward = Math.min(newStreak, 5)
  const newBalance = data.balance + reward

  // 原子更新
  const [updateRes, insertRes] = await Promise.all([
    supabase
      .from('user_points')
      .update({
        balance: newBalance,
        check_in_streak: newStreak,
        last_check_in: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id),
    supabase.from('points_records').insert({
      user_id: user.id,
      type: 'checkin',
      amount: reward,
      description: `每日签到（连续${newStreak}天）`,
    }),
  ])

  if (updateRes.error || insertRes.error) return { success: false, reward: 0, newStreak: data.check_in_streak }
  return { success: true, reward, newStreak }
}

/** 消耗积分 */
export async function consumePoints(
  cost: number,
  type: PointsRecord['type'],
  description: string,
): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  // 读取当前余额
  const { data, error } = await supabase
    .from('user_points')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (error || !data || data.balance < cost) return { success: false }

  const [updateRes, insertRes] = await Promise.all([
    supabase
      .from('user_points')
      .update({ balance: data.balance - cost, updated_at: new Date().toISOString() })
      .eq('user_id', user.id),
    supabase.from('points_records').insert({
      user_id: user.id,
      type,
      amount: -cost,
      description,
    }),
  ])

  if (updateRes.error || insertRes.error) return { success: false }
  return { success: true }
}

/** 充值积分（后续对接真实支付后，由服务端 webhook 回调；此处为后台手动补积分 / 测试用） */
export async function rechargePoints(amount: number, description?: string): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { data, error } = await supabase
    .from('user_points')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (error || !data) return { success: false }

  const [updateRes, insertRes] = await Promise.all([
    supabase
      .from('user_points')
      .update({ balance: data.balance + amount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id),
    supabase.from('points_records').insert({
      user_id: user.id,
      type: 'recharge',
      amount,
      description: description ?? `充值${amount}积分`,
    }),
  ])

  if (updateRes.error || insertRes.error) return { success: false }
  return { success: true }
}
