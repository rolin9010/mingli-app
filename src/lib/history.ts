import { supabase } from './supabase'
import type { UserInput } from './types'

export type ReadingListItem = {
  id: string
  name: string | null
  birth_date: string | null
  created_at: string
}

export type ReadingDetail = {
  id: string
  user_id: string
  name: string | null
  birth_date: string | null
  input_data: UserInput | null
  ai_report: string | null
  created_at: string
}

/** 保存一次排盘记录 */
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

/** 获取用户历史记录列表 */
export async function getReadings(): Promise<ReadingListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('readings')
    .select('id, name, birth_date, created_at')
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
