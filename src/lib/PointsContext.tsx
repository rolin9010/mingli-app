import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  loadPointsState,
  checkIn,
  consumePoints,
  rechargePoints,
  type PointsState,
} from './points'

interface PointsContextValue extends PointsState {
  /** 签到 */
  doCheckIn: () => boolean
  /** 消耗积分，返回是否成功 */
  doConsume: (cost: number, type: 'consume_ai' | 'consume_heban' | 'consume_daily', description: string) => boolean
  /** 充值积分 */
  doRecharge: (amount: number) => void
  /** 刷新状态 */
  refresh: () => void
}

const PointsContext = createContext<PointsContextValue | null>(null)

export function PointsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PointsState>(() => loadPointsState())

  const doCheckIn = useCallback(() => {
    if (state.checkedInToday) return false
    const newState = checkIn(state)
    setState(newState)
    return true
  }, [state])

  const doConsume = useCallback(
    (cost: number, type: 'consume_ai' | 'consume_heban' | 'consume_daily', description: string) => {
      const result = consumePoints(state, cost, type, description)
      setState(result.newState)
      return result.success
    },
    [state],
  )

  const doRecharge = useCallback(
    (amount: number) => {
      const newState = rechargePoints(state, amount)
      setState(newState)
    },
    [state],
  )

  const refresh = useCallback(() => {
    setState(loadPointsState())
  }, [])

  return (
    <PointsContext.Provider
      value={{
        ...state,
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

export function usePoints(): PointsContextValue {
  const ctx = useContext(PointsContext)
  if (!ctx) throw new Error('usePoints must be used within PointsProvider')
  return ctx
}
