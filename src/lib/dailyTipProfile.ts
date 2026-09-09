import { supabase } from './supabase'
import { calcBazi } from './mingli/bazi'
import { computeAll } from './mingli/computeReport'
import type { UserInput } from './types'

export async function saveDailyTipProfile(input: UserInput): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const bazi = calcBazi(input.birth, input.calendarType ?? '公历')
  const result = computeAll(input)
  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    gender: input.gender,
    birth: input.birth,
    calendar_type: input.calendarType ?? '公历',
    location: {
      country: input.country,
      province: input.province,
      city: input.city,
      district: input.district,
      useSolarTime: input.useSolarTime,
    },
    elements: result.bazi.elements.map((item) => ({
      element: item.element,
      percent: item.percent,
    })),
    pillars: bazi.pillars,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('daily_tip_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw error
  return true
}
