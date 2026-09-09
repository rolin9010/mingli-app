export type MiniProgramArchiveDestination = 'history' | 'measurement'

export function resolveMiniProgramArchiveDestination(
  personalArchiveCount: number,
): MiniProgramArchiveDestination {
  return personalArchiveCount > 0 ? 'history' : 'measurement'
}

export function buildMiniProgramMeasurementUrl(showOnboarding = false): string {
  return showOnboarding ? '/?miniprogram=1&onboarding=1' : '/?miniprogram=1'
}

/**
 * 小程序会在一次性登录后带着绑定用户 id 打开历史页。
 * 仅当当前 Supabase 会话与该 id 一致时开放修改、删除与积分操作。
 */
export function hasAuthenticatedMiniProgramHistorySession(
  requestedUserId: string,
  authenticatedUserId?: string | null,
): boolean {
  return Boolean(
    requestedUserId
    && authenticatedUserId
    && requestedUserId === authenticatedUserId,
  )
}
