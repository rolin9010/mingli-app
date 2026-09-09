import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import {
  loadPointsState,
  checkIn,
  type PointsState,
} from './points'

// ─── Context 类型 ─────────────────────────────────────────────────────────────

interface PointsContextValue extends PointsState {
  /** 是否正在加载（首次 / 登录后同步中） */
  loading: boolean
  /** 签到，返回是否成功 */
  doCheckIn: () => Promise<boolean>
  /** 手动刷新积分状态 */
  refresh: () => Promise<void>
}

const DEFAULT_STATE: PointsState = {
  balance: 0,
  checkedInToday: false,
  checkInStreak: 0,
  records: [],
}

const PointsContext = createContext<PointsContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PointsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PointsState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)

  /** 从 Supabase 同步积分状态 */
  const syncFromServer = useCallback(async () => {
    setLoading(true)
    try {
      const fresh = await loadPointsState()
      setState(fresh)
    } catch {
      // 网络失败时静默降级
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化 + 监听登录/登出事件
  useEffect(() => {
    // 首次加载
    void syncFromServer()

    // 监听认证状态变化：登录 → 拉取云端积分；登出 → 重置为默认
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        && session?.user
      ) {
        void syncFromServer()
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        setState(DEFAULT_STATE)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [syncFromServer])

  // 从小程序、支付页或后台切回时重新读取，避免展示旧会话中的缓存余额。
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncFromServer()
    }
    const refreshOnPageShow = () => void syncFromServer()
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('pageshow', refreshOnPageShow)
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshOnPageShow)
    }
  }, [syncFromServer])

  useEffect(() => {
    const handleBalanceUpdated = (event: Event) => {
      const balance = Number((event as CustomEvent<number>).detail)
      if (!Number.isInteger(balance) || balance < 0) return
      setState((prev) => ({ ...prev, balance }))
    }
    window.addEventListener('points-balance-updated', handleBalanceUpdated)
    return () => window.removeEventListener('points-balance-updated', handleBalanceUpdated)
  }, [])

  // ── 操作方法 ──────────────────────────────────────────────────────────────

  const doCheckIn = useCallback(async (): Promise<boolean> => {
    if (state.checkedInToday) return false
    const result = await checkIn()
    if (result.success) {
      // 以数据库返回和新流水为准，避免本地缓存显示 0 或重复累加。
      await syncFromServer()
    }
    return result.success
  }, [state.checkedInToday, syncFromServer])

  const refresh = useCallback(async () => {
    await syncFromServer()
  }, [syncFromServer])

  return (
    <PointsContext.Provider
      value={{
        ...state,
        loading,
        doCheckIn,
        refresh,
      }}
    >
      {children}
    </PointsContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePoints(): PointsContextValue {
  const ctx = useContext(PointsContext)
  if (!ctx) throw new Error('usePoints must be used within PointsProvider')
  return ctx
}
