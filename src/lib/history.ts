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
    .select('id, name, birth_date, created_at, input_data, ai_report')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data as ReadingListItem[]) || []
}

/** 获取单条历史记录详情 */
export async function getReading(id: string): Promise<ReadingDetail> {
  const { data, error } = await supabase.from('readings').select('*').eq('id', id).single()

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
