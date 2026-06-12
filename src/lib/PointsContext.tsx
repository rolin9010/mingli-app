import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from './supabase'
import {
  loadPointsState,
  checkIn,
  consumePoints,
  rechargePoints,
  type PointsState,
  type PointsRecord,
} from './points'

// ─── Context 类型 ─────────────────────────────────────────────────────────────

interface PointsContextValue extends PointsState {
  /** 是否正在加载（首次 / 登录后同步中） */
  loading: boolean
  /** 签到，返回是否成功 */
  doCheckIn: () => Promise<boolean>
  /** 消耗积分，返回是否成功 */
  doConsume: (cost: number, type: PointsRecord['type'], description: string) => Promise<boolean>
  /** 充值积分（测试用；生产环境由支付回调触发） */
  doRecharge: (amount: number) => Promise<void>
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void syncFromServer()
      } else if (event === 'SIGNED_OUT') {
        setState(DEFAULT_STATE)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [syncFromServer])

  // ── 操作方法 ──────────────────────────────────────────────────────────────

  const doCheckIn = useCallback(async (): Promise<boolean> => {
    if (state.checkedInToday) return false
    const result = await checkIn()
    if (result.success) {
      setState((prev) => {
        const record: PointsRecord = {
          id: Date.now().toString(36),
          type: 'checkin',
          amount: result.reward,
          description: `每日签到（连续${result.newStreak}天）`,
          createdAt: new Date().toISOString(),
        }
        return {
          ...prev,
          balance: prev.balance + result.reward,
          checkedInToday: true,
          checkInStreak: result.newStreak,
          records: [record, ...prev.records],
        }
      })
    }
    return result.success
  }, [state.checkedInToday])

  const doConsume = useCallback(
    async (cost: number, type: PointsRecord['type'], description: string): Promise<boolean> => {
      if (state.balance < cost) return false
      const result = await consumePoints(cost, type, description)
      if (result.success) {
        setState((prev) => {
          const record: PointsRecord = {
            id: Date.now().toString(36),
            type,
            amount: -cost,
            description,
            createdAt: new Date().toISOString(),
          }
          return {
            ...prev,
            balance: prev.balance - cost,
            records: [record, ...prev.records],
          }
        })
      }
      return result.success
    },
    [state.balance],
  )

  const doRecharge = useCallback(async (amount: number): Promise<void> => {
    const result = await rechargePoints(amount)
    if (result.success) {
      setState((prev) => {
        const record: PointsRecord = {
          id: Date.now().toString(36),
          type: 'recharge',
          amount,
          description: `充值${amount}积分`,
          createdAt: new Date().toISOString(),
        }
        return {
          ...prev,
          balance: prev.balance + amount,
          records: [record, ...prev.records],
        }
      })
    }
  }, [])

  const refresh = useCallback(async () => {
    await syncFromServer()
  }, [syncFromServer])

  return (
    <PointsContext.Provider
      value={{
        ...state,
        loading,
        doCheckIn,
        doConsume,
        doRecharge,
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
