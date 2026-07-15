/**
 * 后台管理数据访问层
 * 所有函数仅供管理员调用，依赖 Supabase RLS 管理员策略
 */

import { supabase } from './supabase'
import { calcBazi } from './mingli/bazi'

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

export interface AdminSessionUserSnap {
  name: string | null
  birth_date: string | null
  /** { element: '木'|'火'|'土'|'金'|'水', percent: number }[] */
  elements: { element: string; percent: number }[] | null
  /** 四柱，如 ["甲子","乙丑","丙寅","丁卯"] */
  pillars: string[] | null
  balance: number
  readingCount: number
}

export interface AdminSession {
  /** 用户维度的唯一标识（实际就是 user_id） */
  session_id: string
  user_id: string
  user_email: string
  last_message: string
  last_time: string
  unread_count: number
  messages: AdminMessage[]
  /** 用户最近一次测算的快照摘要（可能为 null） */
  userSnap: AdminSessionUserSnap | null
}

export interface AdminMessage {
  id: string
  session_id: string
  content: string
  reply: string | null
  replied_at: string | null
  created_at: string
  context_info: string | null
  admin_read_at: string | null
}

export interface AdminStats {
  totalUsers: number
  todayRegistered: number
  todayPointsConsumed: number
  pendingMessages: number
  dailyRegistrations: { date: string; count: number }[]
}

interface AdminAuthUser {
  id: string
  email: string
  created_at: string
}

// ─── 鉴权 ─────────────────────────────────────────────────────────────────────

/** 判断当前用户是否是管理员 */
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined
  if (!raw) return false
  return raw.split(',').map((e) => e.trim().toLowerCase()).includes(email.toLowerCase())
}

async function adminApiToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function adminFetchAuthUsers(ids?: string[]): Promise<AdminAuthUser[]> {
  const token = await adminApiToken()
  if (!token) return []

  const params = new URLSearchParams()
  if (ids && ids.length > 0) params.set('ids', ids.join(','))

  const res = await fetch(`/api/admin/users${params.toString() ? `?${params}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []

  const data = await res.json() as { users?: AdminAuthUser[] }
  return data.users ?? []
}

async function adminFetchAuthUserCount(): Promise<number | null> {
  const token = await adminApiToken()
  if (!token) return null

  const res = await fetch('/api/admin/users?countOnly=1', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null

  const data = await res.json() as { total?: number }
  return typeof data.total === 'number' ? data.total : null
}

// ─── 用户管理 ─────────────────────────────────────────────────────────────────

/** 获取用户列表（含积分余额和测算次数） */
export async function adminGetUsers(): Promise<AdminUser[]> {
  const [authUsers, pointsRes, readingsRes] = await Promise.all([
    adminFetchAuthUsers(),
    supabase
      .from('user_points')
      .select('user_id, balance'),
    supabase
      .from('readings')
      .select('user_id'),
  ])

  // 统计每个用户的测算次数
  const readingCountMap = new Map<string, number>()
  for (const r of readingsRes.data ?? []) {
    if (!r.user_id) continue
    readingCountMap.set(r.user_id as string, (readingCountMap.get(r.user_id as string) ?? 0) + 1)
  }

  const pointsMap = new Map((pointsRes.data ?? []).map((p) => [p.user_id as string, p.balance as number]))

  // 如果管理员 API 查询成功，直接用 auth.users 数据（最准确）
  if (authUsers.length > 0) {
    return authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? '(未知)',
      created_at: u.created_at,
      balance: pointsMap.get(u.id) ?? 0,
      readingCount: readingCountMap.get(u.id) ?? 0,
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // 兜底：从 readings 表里的 user_email 聚合（老方案）
  const { data: readingsData } = await supabase
    .from('readings')
    .select('user_id, user_email, created_at')
    .order('created_at', { ascending: false })

  const userMap = new Map<string, { email: string; created_at: string; readingCount: number }>()
  for (const r of readingsData ?? []) {
    if (!r.user_id) continue
    const existing = userMap.get(r.user_id as string)
    if (!existing) {
      userMap.set(r.user_id as string, {
        email: (r.user_email as string) ?? '(未知)',
        created_at: r.created_at as string,
        readingCount: 1,
      })
    } else {
      existing.readingCount++
    }
  }

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
  const [pointsRes, recordsRes, readingsRes, userRes] = await Promise.all([
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
    adminFetchAuthUsers([userId]),
  ])

  const authUser = userRes[0]
  // 优先用 Auth 用户邮箱，其次读 readings 里的 user_email
  const email =
    authUser?.email ??
    (readingsRes.data?.[0] as { user_email?: string } | undefined)?.user_email ??
    '(未知)'

  const createdAt =
    authUser?.created_at ??
    readingsRes.data?.[0]?.created_at ?? ''

  return {
    id: userId,
    email,
    created_at: createdAt,
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

/** 获取所有会话列表（含用户摘要快照） */
export async function adminGetSessions(): Promise<AdminSession[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, session_id, user_id, content, reply, replied_at, created_at, context_info, admin_read_at')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  // 按 user_id 分组（同一用户的所有会话合并为一条）
  const sessionMap = new Map<string, {
    user_id: string
    messages: AdminMessage[]
  }>()

  for (const row of data) {
    const uid = (row.user_id as string) || 'anonymous'
    if (!sessionMap.has(uid)) {
      sessionMap.set(uid, { user_id: uid, messages: [] })
    }
    sessionMap.get(uid)!.messages.push({
      id: row.id as string,
      session_id: row.session_id as string,
      content: row.content as string,
      reply: row.reply as string | null,
      replied_at: row.replied_at as string | null,
      created_at: row.created_at as string,
      context_info: row.context_info as string | null,
      admin_read_at: row.admin_read_at as string | null,
    })
  }

  const allUserIds = Array.from(new Set(
    Array.from(sessionMap.values()).map((s) => s.user_id).filter(Boolean)
  ))

  // 并行查：邮箱、积分、最近一条测算
  const [emailViewRes, readingsRes, pointsRes] = await Promise.all([
    allUserIds.length > 0
      ? adminFetchAuthUsers(allUserIds)
      : Promise.resolve([]),
    allUserIds.length > 0
      ? supabase
          .from('readings')
          .select('user_id, user_email, name, birth_date, input_data')
          .in('user_id', allUserIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    allUserIds.length > 0
      ? supabase.from('user_points').select('user_id, balance').in('user_id', allUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const emailMap = new Map<string, string>()
  for (const r of emailViewRes) {
    if (r.id && r.email) emailMap.set(r.id, r.email)
  }
  // 兜底：从 readings 里补充邮箱
  for (const r of (readingsRes.data ?? []) as { user_id: string; user_email?: string }[]) {
    if (r.user_id && r.user_email && !emailMap.has(r.user_id)) {
      emailMap.set(r.user_id, r.user_email)
    }
  }

  const pointsMap = new Map<string, number>()
  for (const p of (pointsRes.data ?? []) as { user_id: string; balance: number }[]) {
    pointsMap.set(p.user_id, p.balance)
  }

  // 每个 user_id 的最新一条测算（readings 已按 created_at desc，第一次出现即最新）
  type ReadingRow = {
    user_id: string
    user_email?: string
    name?: string
    birth_date?: string
    input_data?: unknown
  }
  const latestReadingMap = new Map<string, ReadingRow>()
  const readingCountMap = new Map<string, number>()
  for (const r of (readingsRes.data ?? []) as ReadingRow[]) {
    if (!r.user_id) continue
    readingCountMap.set(r.user_id, (readingCountMap.get(r.user_id) ?? 0) + 1)
    if (!latestReadingMap.has(r.user_id)) latestReadingMap.set(r.user_id, r)
  }

  /**
   * 从 input_data 提取八字四柱 + 五行占比
   * 直接调用 calcBazi（lunar-javascript，带节气修正），确保准确
   */
  function extractBazi(inputData: unknown): {
    pillars: string[] | null
    elements: { element: string; percent: number }[] | null
  } {
    try {
      if (!inputData || typeof inputData !== 'object') return { pillars: null, elements: null }
      const data = inputData as Record<string, unknown>
      // 单人：{ birth: { year, month, day, hour, minute? }, calendarType? }
      // 合盘：{ personA: { birth: ..., calendarType? }, ... }
      const birth = (data.birth as Record<string, number> | undefined) ??
        ((data.personA as Record<string, unknown> | undefined)?.birth as Record<string, number> | undefined)
      if (!birth?.year) return { pillars: null, elements: null }

      const calendarType = ((data.calendarType as string | undefined) ??
        ((data.personA as Record<string, unknown> | undefined)?.calendarType as string | undefined) ??
        '公历') as '公历' | '农历'

      const birthInput = {
        year: Number(birth.year),
        month: Number(birth.month ?? 1),
        day: Number(birth.day ?? 1),
        hour: Number(birth.hour ?? 0),
        minute: Number(birth.minute ?? 0),
      }

      const result = calcBazi(birthInput, calendarType)
      const pillars = [result.pillars.year, result.pillars.month, result.pillars.day, result.pillars.hour]
      const elements = result.elements.map((e) => ({ element: e.element, percent: e.percent }))
      return { pillars, elements }
    } catch {
      return { pillars: null, elements: null }
    }
  }

  return Array.from(sessionMap.entries()).map(([uid, s]) => {
    // 消息已按 created_at asc 报入，直接取最后一条
    const msgs = s.messages
    const last = msgs[msgs.length - 1]
    // 有任何一条消息未被管理员读取过，则算未读
    const unread = msgs.filter((m) => !m.admin_read_at).length
    const reading = latestReadingMap.get(uid)
    const bazi = reading ? extractBazi(reading.input_data) : null
    const userSnap: AdminSessionUserSnap | null = reading ? {
      name: (reading.name as string | undefined) ?? null,
      birth_date: (reading.birth_date as string | undefined) ?? null,
      elements: bazi?.elements ?? null,
      pillars: bazi?.pillars ?? null,
      balance: pointsMap.get(uid) ?? 0,
      readingCount: readingCountMap.get(uid) ?? 0,
    } : null
    return {
      session_id: uid,   // 用 user_id 作为会话唯一 key
      user_id: uid,
      user_email: emailMap.get(uid) ?? uid ?? 'anonymous',
      last_message: last.content,
      last_time: last.created_at,
      unread_count: unread,
      messages: msgs,
      userSnap,
    }
  }).sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime())
}

/** 标记某个用户的所有消息为管理员已读（session_id 实际上就是 user_id） */
export async function adminMarkSessionRead(userId: string): Promise<void> {
  await supabase
    .from('support_messages')
    .update({ admin_read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('admin_read_at', null)  // 只更新还没标记过的，减少写操作
}

/** 回复某条消息（同时顺带标记该条消息已读） */
export async function adminReplyMessage(
  messageId: string,
  reply: string,
): Promise<{ success: boolean }> {
  const { error, data } = await supabase
    .from('support_messages')
    .update({ reply, replied_at: new Date().toISOString(), admin_read_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()

  console.log('[adminReplyMessage] messageId:', messageId, 'updated rows:', data?.length, 'error:', error)
  return { success: !error && (data?.length ?? 0) > 0 }
}

/**
 * 管理员主动向用户发消息（不依附于用户的某条消息）
 * 实现方式：插入一条新记录，content 用占位符，reply 填管理员内容
 * 用户端 dbToUiMessages 会将 reply 渲染为客服消息气泡
 */
export async function adminSendProactiveMessage(
  userId: string,
  sessionId: string,
  text: string,
): Promise<{ success: boolean }> {
  const now = new Date().toISOString()
  console.log('[adminSendProactiveMessage] inserting for userId:', userId, 'sessionId:', sessionId)
  const { error, data } = await supabase
    .from('support_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      content: '__admin_proactive__',   // 占位符，后台不展示用户气泡
      reply: text,
      replied_at: now,
      admin_read_at: now,
    })
    .select()
  console.log('[adminSendProactiveMessage] result:', { error, data })

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

  const [pendingRes, pointsRes, readingsCountRes, todayReadingsRes, authUserCount] = await Promise.all([
    // 拉取所有消息的 user_id、content、reply，后面在 JS 端按用户维度判断
    supabase
      .from('support_messages')
      .select('user_id, content, reply')
      .order('created_at', { ascending: true }),
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
    adminFetchAuthUserCount(),
  ])

  // 统计近 7 天每日测算条数
  const dayCountMap = new Map<string, number>()
  days.forEach((d) => dayCountMap.set(d, 0))
  for (const r of readingsCountRes.data ?? []) {
    const day = (r.created_at as string).slice(0, 10)
    if (dayCountMap.has(day)) dayCountMap.set(day, (dayCountMap.get(day) ?? 0) + 1)
  }

  const todayConsumed = (pointsRes.data ?? []).reduce((sum, r) => sum + Math.abs(r.amount as number), 0)

  // 总用户数：通过管理员 API 从 auth.users 计数；失败则兜底用 user_points 表
  let totalUsers = authUserCount ?? 0
  if (authUserCount === null) {
    const { count: fallbackCount } = await supabase
      .from('user_points')
      .select('user_id', { count: 'exact', head: true })
    totalUsers = fallbackCount ?? 0
  }

  return {
    totalUsers: totalUsers ?? 0,
    todayRegistered: todayReadingsRes.count ?? 0,
    todayPointsConsumed: todayConsumed,
    // 待回复用户数：按用户分组，取每个用户最后一条真实消息（排除占位符），若未回复则算待回复
    pendingMessages: (() => {
      type MsgRow = { user_id: string; content: string; reply: string | null }
      const allMsgs = (pendingRes.data ?? []) as MsgRow[]
      // 按 user_id 聚合，只保留最后一条真实消息（已按 created_at asc，直接取最后出现的）
      const lastRealMsg = new Map<string, MsgRow>()
      for (const m of allMsgs) {
        if (!m.user_id || m.content === '__admin_proactive__') continue
        lastRealMsg.set(m.user_id, m)  // 后覆盖前，最终留下时间最新的
      }
      // 统计最后一条真实消息没有回复的用户数
      let count = 0
      for (const msg of lastRealMsg.values()) {
        if (!msg.reply) count++
      }
      return count
    })(),
    dailyRegistrations: days.map((d) => ({
       date: d,
       count: dayCountMap.get(d) ?? 0,
     })),
  }
}

// ─── 按日期查测算记录（概览柱状图点击用） ────────────────────────────────────

export interface DayReadingItem {
  id: string
  user_id: string
  user_email: string
  name: string | null
  birth_date: string | null
  created_at: string
  input_data: unknown
  ai_report: string | null
}

/** 查询某天（YYYY-MM-DD）所有测算记录，按用户聚合后返回 */
export async function adminGetReadingsByDate(date: string): Promise<DayReadingItem[]> {
  const start = date + 'T00:00:00.000Z'
  const end   = date + 'T23:59:59.999Z'

  const { data, error } = await supabase
    .from('readings')
    .select('id, user_id, user_email, name, birth_date, created_at, input_data, ai_report')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  // 补充邮箱（优先用管理员 API）
  const userIds = [...new Set((data as { user_id: string }[]).map((r) => r.user_id).filter(Boolean))]
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const viewData = await adminFetchAuthUsers(userIds)
    for (const r of viewData) {
      if (r.id && r.email) emailMap.set(r.id, r.email)
    }
  }

  return (data as DayReadingItem[]).map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? r.user_email ?? r.user_id,
  }))
}
