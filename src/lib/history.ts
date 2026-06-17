import { supabase } from './supabase'
import type { UserInput, HeBanUserInput } from './types'

export type ReadingListItem = {
  id: string
  name: string | null
  birth_date: string | null
  created_at: string
  input_data?: UserInput | HeBanUserInput | null
  /** 非空字符串表示已有 AI 解读 */
  ai_report?: string | null
}

export type ReadingDetail = {
  id: string
  user_id: string
  name: string | null
  birth_date: string | null
  input_data: UserInput | HeBanUserInput | null
  ai_report: string | null
  created_at: string
}

/** 判断 input_data 是否为合盘记录 */
export function isHeBanInputData(data: UserInput | HeBanUserInput | null): data is HeBanUserInput {
  return data !== null && 'personA' in data && 'personB' in data && 'relation' in data
}

/** 保存一次单人排盘记录 */
export async function saveReading(input: UserInput, aiReport: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      input_data: input,
      ai_report: aiReport,
      name: input.name || '未命名',
      birth_date: `${input.birth.year}-${String(input.birth.month).padStart(2, '0')}-${String(input.birth.day).padStart(2, '0')}`,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** 保存一次合盘记录 */
export async function saveHeBanReading(input: HeBanUserInput, aiReport: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('readings')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      input_data: input as unknown as Record<string, unknown>,
      ai_report: aiReport,
      name: `${input.personA.name} × ${input.personB.name}`,
      birth_date: `${input.personA.birth.year}-${String(input.personA.birth.month).padStart(2, '0')}-${String(input.personA.birth.day).padStart(2, '0')}`,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** 获取用户历史记录列表 */
export async function getReadings(): Promise<ReadingListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('readings')
    .select('id, name, birth_date, created_at, input_data, ai_report, is_primary')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data as ReadingListItem[]) || []
}

/** 获取单条历史记录详情 */
export async function getReading(id: string): Promise<ReadingDetail> {
  const { data: { user } } = await supabase.auth.getUser()
  let query = supabase.from('readings').select('*').eq('id', id)
  // 非管理员（普通用户）加上 user_id 过滤，确保 RLS 通过
  if (user) query = query.eq('user_id', user.id)
  const { data, error } = await query.single()

  if (error) throw error
  return data as ReadingDetail
}

/** 删除一条历史记录 */
export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from('readings').delete().eq('id', id)
  if (error) throw error
}

/** 修改历史记录的备注名称 */
export async function updateReadingName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('readings').update({ name }).eq('id', id)
  if (error) throw error
}

/** 五行能量摘要类型（供小程序展示用） */
export type BaziSummary = {
  pillars: { year: string; month: string; day: string; hour: string }
  elements: { element: string; percent: number }[]
}

/** 设置某条记录为「我的八字」（同时清除同用户其他记录的 is_primary） */
export async function setPrimaryReading(id: string, baziSummary?: BaziSummary): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  // 先清除本用户所有 is_primary
  const { error: clearErr } = await supabase
    .from('readings')
    .update({ is_primary: false })
    .eq('user_id', user.id)
    .eq('is_primary', true)
  if (clearErr) throw clearErr

  // 再设置目标记录（附带 bazi_summary）
  const updatePayload: Record<string, unknown> = { is_primary: true }
  if (baziSummary) updatePayload.bazi_summary = baziSummary

  const { error } = await supabase
    .from('readings')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
}

/** 获取当前用户「我的八字」记录（is_primary = true） */
export async function getPrimaryReading(): Promise<ReadingListItem | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('readings')
    .select('id, name, birth_date, created_at, input_data, ai_report, is_primary')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (error) return null
  return data as ReadingListItem & { is_primary: boolean }
}

/** 生成 6 位绑定码（10 分钟有效期），存入 binding_codes 表 */
export async function generateBindingCode(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  // 生成 6 位随机数字码
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // 先删除该用户旧的绑定码
  await supabase.from('binding_codes').delete().eq('user_id', user.id)

  // 插入新码
  const { error } = await supabase.from('binding_codes').insert({
    code,
    user_id: user.id,
    expires_at: expiresAt,
  })
  if (error) throw error

  return code
}

/**
 * 小程序访客模式：通过 Vercel API 免登录获取指定 uid 用户的历史记录
 * （绕过 Supabase RLS，在后端用 service_role key 查询）
 */
export async function getReadingsForMiniprogram(uid: string): Promise<ReadingListItem[]> {
  const res = await fetch(`/api/miniprogram-readings?uid=${encodeURIComponent(uid)}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json() as { readings: ReadingListItem[] }
  return json.readings ?? []
}
