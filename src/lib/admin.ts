/**
 * 后台管理数据访问层
 * 所有函数仅供管理员调用，依赖 Supabase RLS 管理员策略
 */

import { supabase } from './supabase'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  created_at: string
  balance: number
  readingCount: number
}

export interface AdminUserDetail extends AdminUser {
  records: AdminPointsRecord[]
  readings: AdminReading[]
}

export interface AdminPointsRecord {
  id: string
  type: string
  amount: number
  description: string
  created_at: string
}

export interface AdminReading {
  id: string
  name: string | null
  birth_date: string | null
  created_at: string
  input_data: unknown
  ai_report: string | null
}

export interface AdminSession {
  session_id: string
  user_id: string
  user_email: string
  last_message: string
  last_time: string
  unread_count: number
  messages: AdminMessage[]
}

export interface AdminMessage {
  id: string
  content: string
  reply: string | null
  replied_at: string | null
  created_at: string
  context_info: string | null
}

export interface AdminStats {
  totalUsers: number
  todayRegistered: number
  todayPointsConsumed: number
  pendingMessages: number
  dailyRegistrations: { date: string; count: number }[]
}

// ─── 鉴权 ─────────────────────────────────────────────────────────────────────

/** 判断当前用户是否是管理员 */
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined
  if (!raw) return false
  return raw.split(',').map((e) => e.trim().toLowerCase()).includes(email.toLowerCase())
}

// ─── 用户管理 ─────────────────────────────────────────────────────────────────

/** 获取用户列表（含积分余额和测算次数） */
export async function adminGetUsers(): Promise<AdminUser[]> {
  // 查积分表
  const { data: pointsData } = await supabase
    .from('user_points')
    .select('user_id, balance')

  // 查测算记录数
  const { data: readingsData } = await supabase
    .from('readings')
    .select('user_id, user_email, created_at')
    .order('created_at', { ascending: false })

  // 查 auth.users（通过 readings 表里存的 user_email 来获取用户信息）
  // 先聚合出所有不重复的 user_id + email
  const userMap = new Map<string, { email: string; created_at: string; readingCount: number }>()

  for (const r of readingsData ?? []) {
    if (!r.user_id) continue
    const existing = userMap.get(r.user_id)
    if (!existing) {
      userMap.set(r.user_id, {
        email: r.user_email ?? '(未知)',
        created_at: r.created_at,
        readingCount: 1,
      })
    } else {
      existing.readingCount++
    }
  }

  // 也纳入有积分但无测算记录的用户（从 support_messages 补充）
  const { data: msgData } = await supabase
    .from('support_messages')
    .select('user_id')

  for (const m of msgData ?? []) {
    if (m.user_id && m.user_id !== 'anonymous' && !userMap.has(m.user_id)) {
      userMap.set(m.user_id, { email: '(无测算记录)', created_at: '', readingCount: 0 })
    }
  }

  const pointsMap = new Map((pointsData ?? []).map((p) => [p.user_id, p.balance as number]))

  return Array.from(userMap.entries()).map(([id, info]) => ({
    id,
    email: info.email,
    created_at: info.created_at,
    balance: pointsMap.get(id) ?? 0,
    readingCount: info.readingCount,
  }))
}

/** 获取单个用户详情 */
export async function adminGetUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const [pointsRes, recordsRes, readingsRes] = await Promise.all([
    supabase.from('user_points').select('user_id, balance').eq('user_id', userId).single(),
    supabase
      .from('points_records')
      .select('id, type, amount, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('readings')
      .select('id, name, birth_date, created_at, input_data, ai_report, user_email')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const email = (readingsRes.data?.[0] as { user_email?: string } | undefined)?.user_email ?? '(未知)'

  return {
    id: userId,
    email,
    created_at: readingsRes.data?.[0]?.created_at ?? '',
    balance: (pointsRes.data?.balance as number) ?? 0,
    readingCount: readingsRes.data?.length ?? 0,
    records: (recordsRes.data ?? []) as AdminPointsRecord[],
    readings: (readingsRes.data ?? []) as AdminReading[],
  }
}

/** 给用户调整积分 */
export async function adminAdjustPoints(
  userId: string,
  delta: number,
  description: string,
): Promise<{ success: boolean; error?: string }> {
  // 先读当前余额
  const { data: current, error: fetchErr } = await supabase
    .from('user_points')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (fetchErr || !current) return { success: false, error: '用户不存在' }

  const newBalance = (current.balance as number) + delta
  if (newBalance < 0) return { success: false, error: '积分不足，余额会变为负数' }

  const [updateRes, insertRes] = await Promise.all([
    supabase
      .from('user_points')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId),
    supabase.from('points_records').insert({
      user_id: userId,
      type: 'reward',
      amount: delta,
      description: `[管理员] ${description}`,
    }),
  ])

  if (updateRes.error || insertRes.error) {
    return { success: false, error: '操作失败，请重试' }
  }
  return { success: true }
}

// ─── 消息管理 ─────────────────────────────────────────────────────────────────

/** 获取所有会话列表 */
export async function adminGetSessions(): Promise<AdminSession[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, session_id, user_id, content, reply, replied_at, created_at, context_info')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  // 按 session_id 分组
  const sessionMap = new Map<string, {
    user_id: string
    messages: AdminMessage[]
  }>()

  for (const row of data) {
    const sid = row.session_id as string
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, { user_id: row.user_id as string, messages: [] })
    }
    sessionMap.get(sid)!.messages.push({
      id: row.id as string,
      content: row.content as string,
      reply: row.reply as string | null,
      replied_at: row.replied_at as string | null,
      created_at: row.created_at as string,
      context_info: row.context_info as string | null,
    })
  }

  // 查每个 user_id 对应的邮箱（从 readings 表）
  const allUserIds = Array.from(new Set(Array.from(sessionMap.values()).map((s) => s.user_id).filter(Boolean)))
  const emailMap = new Map<string, string>()
  if (allUserIds.length > 0) {
    const { data: emailData } = await supabase
      .from('readings')
      .select('user_id, user_email')
      .in('user_id', allUserIds)
    for (const r of emailData ?? []) {
      if (r.user_id && r.user_email) emailMap.set(r.user_id as string, r.user_email as string)
    }
  }

  return Array.from(sessionMap.entries()).map(([sid, s]) => {
    const msgs = s.messages
    const last = msgs[msgs.length - 1]
    const unread = msgs.filter((m) => !m.reply).length
    return {
      session_id: sid,
      user_id: s.user_id,
      user_email: emailMap.get(s.user_id) ?? s.user_id ?? 'anonymous',
      last_message: last.content,
      last_time: last.created_at,
      unread_count: unread,
      messages: msgs,
    }
  }).sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime())
}

/** 回复某条消息 */
export async function adminReplyMessage(
  messageId: string,
  reply: string,
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('support_messages')
    .update({ reply, replied_at: new Date().toISOString() })
    .eq('id', messageId)

  return { success: !error }
}

// ─── 数据概览 ─────────────────────────────────────────────────────────────────

/** 获取后台统计数据 */
export async function adminGetStats(): Promise<AdminStats> {
  const today = new Date().toISOString().slice(0, 10)

  // 过去 7 天的日期列表
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const sevenDaysAgo = days[0] + 'T00:00:00.000Z'

  const [pendingRes, pointsRes, readingsCountRes, todayReadingsRes] = await Promise.all([
    // 待回复消息数
    supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .is('reply', null),
    // 今日积分消耗
    supabase
      .from('points_records')
      .select('amount')
      .lt('amount', 0)
      .gte('created_at', today + 'T00:00:00.000Z'),
    // 近 7 天注册（用 readings 表按 user_id 去重粗估）
    supabase
      .from('readings')
      .select('user_id, created_at')
      .gte('created_at', sevenDaysAgo),
    // 今日新测算（粗估活跃）
    supabase
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00.000Z'),
  ])

  // 统计近 7 天每日测算量（按 user_id 近似注册）
  const dayCountMap = new Map<string, Set<string>>()
  days.forEach((d) => dayCountMap.set(d, new Set()))
  for (const r of readingsCountRes.data ?? []) {
    const day = (r.created_at as string).slice(0, 10)
    if (dayCountMap.has(day)) dayCountMap.get(day)!.add(r.user_id as string)
  }

  const todayConsumed = (pointsRes.data ?? []).reduce((sum, r) => sum + Math.abs(r.amount as number), 0)

  // 总用户数：查 admin_user_count view（从 auth.users 计数，最准确）
  // 如果 view 不存在则兜底用 user_points 表
  let totalUsers = 0
  const { data: countViewData } = await supabase
    .from('admin_user_count')
    .select('total')
    .single()
  if (countViewData && (countViewData as { total: number }).total) {
    totalUsers = Number((countViewData as { total: number }).total)
  } else {
    const { count: fallbackCount } = await supabase
      .from('user_points')
      .select('user_id', { count: 'exact', head: true })
    totalUsers = fallbackCount ?? 0
  }

  return {
    totalUsers: totalUsers ?? 0,
    todayRegistered: todayReadingsRes.count ?? 0,
    todayPointsConsumed: todayConsumed,
    pendingMessages: pendingRes.count ?? 0,
    dailyRegistrations: days.map((d) => ({
      date: d,
      count: dayCountMap.get(d)?.size ?? 0,
    })),
  }
}
