/**
 * 积分系统 - 前端状态管理（localStorage 持久化）
 * 后端 API 对接后，将 localStorage 替换为 API 调用
 */

const STORAGE_KEY = 'wuxingme_points'

export interface PointsState {
  /** 当前积分余额 */
  balance: number
  /** 今日是否已签到 */
  checkedInToday: boolean
  /** 连续签到天数 */
  checkInStreak: number
  /** 积分记录 */
  records: PointsRecord[]
}

export interface PointsRecord {
  id: string
  type: 'recharge' | 'checkin' | 'invite' | 'consume_ai' | 'consume_heban' | 'consume_daily' | 'reward'
  amount: number
  description: string
  createdAt: string
}

const DEFAULT_STATE: PointsState = {
  balance: 5, // 新用户赠送5积分
  checkedInToday: false,
  checkInStreak: 0,
  records: [],
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 从 localStorage 读取积分状态 */
export function loadPointsState(): PointsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, records: [{ id: generateId(), type: 'reward', amount: 5, description: '新用户赠送', createdAt: new Date().toISOString() }] }
    const state = JSON.parse(raw) as PointsState
    // 检查今天是否已签到（跨天重置）
    if (state.checkedInToday) {
      const lastRecord = state.records.find(r => r.type === 'checkin')
      if (lastRecord) {
        const lastDate = new Date(lastRecord.createdAt).toDateString()
        const today = new Date().toDateString()
        if (lastDate !== today) {
          state.checkedInToday = false
        }
      }
    }
    return state
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/** 保存积分状态到 localStorage */
export function savePointsState(state: PointsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** 签到 */
export function checkIn(state: PointsState): PointsState {
  if (state.checkedInToday) return state
  const reward = Math.min(state.checkInStreak + 1, 5) // 连续签到最多5积分
  const record: PointsRecord = {
    id: generateId(),
    type: 'checkin',
    amount: reward,
    description: `每日签到（连续${state.checkInStreak + 1}天）`,
    createdAt: new Date().toISOString(),
  }
  const newState: PointsState = {
    balance: state.balance + reward,
    checkedInToday: true,
    checkInStreak: state.checkInStreak + 1,
    records: [record, ...state.records],
  }
  savePointsState(newState)
  return newState
}

/** 消耗积分 */
export function consumePoints(
  state: PointsState,
  cost: number,
  type: PointsRecord['type'],
  description: string,
): { success: boolean; newState: PointsState } {
  if (state.balance < cost) {
    return { success: false, newState: state }
  }
  const record: PointsRecord = {
    id: generateId(),
    type,
    amount: -cost,
    description,
    createdAt: new Date().toISOString(),
  }
  const newState: PointsState = {
    ...state,
    balance: state.balance - cost,
    records: [record, ...state.records],
  }
  savePointsState(newState)
  return { success: true, newState }
}

/** 充值积分（模拟，后续对接微信支付） */
export function rechargePoints(state: PointsState, amount: number): PointsState {
  const record: PointsRecord = {
    id: generateId(),
    type: 'recharge',
    amount,
    description: `充值${amount}积分`,
    createdAt: new Date().toISOString(),
  }
  const newState: PointsState = {
    ...state,
    balance: state.balance + amount,
    records: [record, ...state.records],
  }
  savePointsState(newState)
  return newState
}

/** 积分消耗常量 */
export const POINTS_COST = {
  AI_READING_QUICK: 3,   // AI 快速解读
  AI_READING_DEEP: 9,    // AI 深度解读
  HEBAN_READING_QUICK: 3, // 合盘快速解读
  HEBAN_READING_DEEP: 9,  // 合盘深度解读
  DAILY_TIP: 1,           // 每日贴士
} as const
