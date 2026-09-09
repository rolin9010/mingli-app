import type { SupabaseClient } from '@supabase/supabase-js'

interface MembershipExpiryRow {
  expires_at?: string | null
}

export function hasActiveMembership(
  rows: MembershipExpiryRow[] | null | undefined,
  now = Date.now(),
): boolean {
  return (rows ?? []).some((row) => {
    const expiresAt = Date.parse(row.expires_at ?? '')
    return Number.isFinite(expiresAt) && expiresAt > now
  })
}

export async function userHasActiveMembership(
  supabase: SupabaseClient<any>,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from('memberships')
    .select('expires_at')
    .eq('user_id', userId)
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)

  if (error) throw new Error('会员状态查询失败')
  return hasActiveMembership(data, now.getTime())
}
