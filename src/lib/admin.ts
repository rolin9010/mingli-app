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
  // 从 admin_users_view 查所有用户（需要在 Supabase 建视图）
  const [usersRes, pointsRes, readingsRes] = await Promise.all([
    supabase
      .from('admin_users_view')
      .select('id, email, created_at')
      .order('created_at', { ascending: false }),
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

  // 如果视图查询成功，直接用视图数据（最准确）
  if (usersRes.data && usersRes.data.length > 0) {
    return (usersRes.data as { id: string; email: string; created_at: string }[]).map((u) => ({
      id: u.id,
      email: u.email ?? '(未知)',
      created_at: u.created_at,
      balance: pointsMap.get(u.id) ?? 0,
      readingCount: readingCountMap.get(u.id) ?? 0,
    }))
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
    // 从视图读邮箱（最准确，覆盖老数据）
    supabase
      .from('admin_users_view')
      .select('email, created_at')
      .eq('id', userId)
      .single(),
  ])

  // 优先用视图里的邮箱，其次读 readings 里的 user_email
  const email =
    (userRes.data as { email?: string } | null)?.email ??
    (readingsRes.data?.[0] as { user_email?: string } | undefined)?.user_email ??
    '(未知)'

  const createdAt =
    (userRes.data as { created_at?: string } | null)?.created_at ??
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
      ? supabase.from('admin_users_view').select('id, email').in('id', allUserIds)
      : Promise.resolve({ data: [] }),
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
  for (const r of (emailViewRes.data ?? []) as { id: string; email: string }[]) {
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

  /** 从 input_data 里用纯 JS 计算五行占比（不依赖 bazi.ts，避免循环依赖） */
  function extractElements(inputData: unknown): { element: string; percent: number }[] | null {
    try {
      if (!inputData || typeof inputData !== 'object') return null
      const data = inputData as Record<string, unknown>
      // 单人：{ birth: { year, month, day, hour } }
      // 合盘：{ personA: { birth: ... }, personB: { birth: ... } }
      const birth = (data.birth as Record<string, number> | undefined) ??
        ((data.personA as Record<string, unknown> | undefined)?.birth as Record<string, number> | undefined)
      if (!birth?.year) return null

      // 天干五行映射
      const stemEl: Record<string, string> = {
        甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'
      }
      // 地支藏干
      const branchHidden: Record<string, {stem:string;weight:number}[]> = {
        子:[{stem:'癸',weight:10}],
        丑:[{stem:'己',weight:6},{stem:'癸',weight:3},{stem:'辛',weight:1}],
        寅:[{stem:'甲',weight:7},{stem:'丙',weight:2},{stem:'戊',weight:1}],
        卯:[{stem:'乙',weight:10}],
        辰:[{stem:'戊',weight:6},{stem:'乙',weight:3},{stem:'癸',weight:1}],
        巳:[{stem:'丙',weight:7},{stem:'庚',weight:2},{stem:'戊',weight:1}],
        午:[{stem:'丁',weight:7},{stem:'己',weight:3}],
        未:[{stem:'己',weight:6},{stem:'丁',weight:3},{stem:'乙',weight:1}],
        申:[{stem:'庚',weight:7},{stem:'壬',weight:2},{stem:'戊',weight:1}],
        酉:[{stem:'辛',weight:10}],
        戌:[{stem:'戊',weight:6},{stem:'辛',weight:3},{stem:'丁',weight:1}],
        亥:[{stem:'壬',weight:7},{stem:'甲',weight:3}],
      }
      const tianGan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
      const diZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
      // 简化版：用年份推算年柱（仅粗估，不做节气修正）
      const y = Number(birth.year)
      const m = Number(birth.month ?? 1)
      const d = Number(birth.day ?? 1)
      const h = Number(birth.hour ?? 0)
      const yearStem = tianGan[(y - 4) % 10]
      const yearBranch = diZhi[(y - 4) % 12]
      // 月支（粗估，不做节气）：月 1-12 对应 寅卯辰巳午未申酉戌亥子丑
      const monthBranchIdx = ((m - 1) + 2) % 12
      const monthBranch = diZhi[monthBranchIdx]
      const monthStemBase = (((y - 4) % 5) * 2) % 10
      const monthStem = tianGan[(monthStemBase + (m - 1)) % 10]
      // 日柱：用简化儒略日
      const julianDay = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d - 1524
      const dayStemIdx = (julianDay + 9) % 10
      const dayBranchIdx = (julianDay + 11) % 12
      const dayStem = tianGan[dayStemIdx]
      const dayBranch = diZhi[dayBranchIdx]
      // 时柱
      const hourBranchIdx = Math.floor((h + 1) / 2) % 12
      const hourStemBase = (dayStemIdx % 5) * 2
      const hourStem = tianGan[(hourStemBase + hourBranchIdx) % 10]
      const hourBranch = diZhi[hourBranchIdx]

      const counts: Record<string, number> = { 木:0, 火:0, 土:0, 金:0, 水:0 }
      const addStem = (s?: string) => { if (s && stemEl[s]) counts[stemEl[s]] += 5 }
      const addBranch = (b?: string) => {
        if (!b) return
        for (const {stem, weight} of branchHidden[b] ?? []) {
          if (stemEl[stem]) counts[stemEl[stem]] += weight
        }
      }
      addStem(yearStem); addBranch(yearBranch)
      addStem(monthStem); addBranch(monthBranch)
      addStem(dayStem); addBranch(dayBranch)
      addStem(hourStem); addBranch(hourBranch)
      const total = Math.max(1, Object.values(counts).reduce((a,b) => a+b, 0))
      return (['木','火','土','金','水'] as const).map(el => ({
        element: el,
        percent: Math.round(counts[el] / total * 1000) / 10,
      }))
    } catch {
      return null
    }
  }

  return Array.from(sessionMap.entries()).map(([uid, s]) => {
    // 消息已按 created_at asc 报入，直接取最后一条
    const msgs = s.messages
    const last = msgs[msgs.length - 1]
    // 有任何一条消息未被管理员读取过，则算未读
    const unread = msgs.filter((m) => !m.admin_read_at).length
    const reading = latestReadingMap.get(uid)
    const userSnap: AdminSessionUserSnap | null = reading ? {
      name: (reading.name as string | undefined) ?? null,
      birth_date: (reading.birth_date as string | undefined) ?? null,
      elements: extractElements(reading.input_data),
      pillars: null,
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
