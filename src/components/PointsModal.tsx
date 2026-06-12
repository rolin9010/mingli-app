import { useState, type ReactNode } from 'react'
import { usePoints } from '../lib/PointsContext'

// ─── 充值套餐 ────────────────────────────────────────────────────────────────
const RECHARGE_PACKS = [
  { points: 10, price: '¥9.9',   unit: '0.99', popular: false },
  { points: 30, price: '¥25',    unit: '0.83', popular: true },
  { points: 100, price: '¥68',   unit: '0.68', popular: false },
  { points: 300, price: '¥168',  unit: '0.56', popular: false },
]

// ─── 签到奖励日历 ────────────────────────────────────────────────────────────
const CHECKIN_REWARDS = [1, 2, 3, 4, 5]

// ─── 积分中心弹窗 ────────────────────────────────────────────────────────────

interface PointsModalProps {
  open: boolean
  onClose: () => void
  /** 预选 Tab: 'recharge' | 'checkin' */
  defaultTab?: 'recharge' | 'checkin'
}

export default function PointsModal({ open, onClose, defaultTab = 'recharge' }: PointsModalProps) {
  const { balance, checkedInToday, checkInStreak, doCheckIn, doRecharge, records } = usePoints()
  const [tab, setTab] = useState<'recharge' | 'checkin'>(defaultTab)
  const [recharging, setRecharging] = useState<number | null>(null)

  if (!open) return null

  const handleRecharge = async (points: number) => {
    setRecharging(points)
    // 模拟支付延迟（后续对接微信支付）
    await new Promise((r) => setTimeout(r, 800))
    doRecharge(points)
    setRecharging(null)
  }

  const handleCheckIn = () => {
    doCheckIn()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗主体 */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
        {/* 顶部 - 积分余额 */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-amber-400/10 via-amber-400/5 to-transparent px-6 py-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">我的积分</div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-amber-100">
                💎 {balance}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setTab('recharge')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'recharge'
                ? 'border-b-2 border-amber-400 text-amber-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💰 充值积分
          </button>
          <button
            type="button"
            onClick={() => setTab('checkin')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'checkin'
                ? 'border-b-2 border-amber-400 text-amber-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 每日签到
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === 'recharge' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">选择充值套餐，积分即时到账</p>
              <div className="grid grid-cols-2 gap-3">
                {RECHARGE_PACKS.map((pack) => (
                  <button
                    key={pack.points}
                    type="button"
                    disabled={recharging !== null}
                    onClick={() => void handleRecharge(pack.points)}
                    className={`relative flex flex-col items-center rounded-xl border p-4 transition-all ${
                      pack.popular
                        ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.1)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    } ${recharging === pack.points ? 'animate-pulse' : ''}`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                        推荐
                      </span>
                    )}
                    <span className="text-2xl font-bold text-amber-100">💎 {pack.points}</span>
                    <span className="mt-1 text-sm font-semibold text-slate-200">{pack.price}</span>
                    <span className="mt-0.5 text-[10px] text-slate-500">¥{pack.unit}/积分</span>
                  </button>
                ))}
              </div>

              {/* 获取积分的其他方式 */}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 text-xs font-medium text-slate-300">免费获取积分</div>
                <div className="space-y-2.5">
                  <FreePointsRow icon="📅" label="每日签到" reward="+1~5积分" actionLabel="去签到" onClick={() => setTab('checkin')} />
                  <FreePointsRow icon="👥" label="邀请好友" reward="+3积分/人" actionLabel="复制链接" onClick={() => { /* TODO */ }} />
                </div>
              </div>
            </div>
          )}

          {tab === 'checkin' && (
            <div className="space-y-4">
              {/* 签到按钮 */}
              <div className="flex flex-col items-center gap-3 py-3">
                <button
                  type="button"
                  disabled={checkedInToday}
                  onClick={handleCheckIn}
                  className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl font-bold transition-all ${
                    checkedInToday
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-400/50 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25 active:scale-95'
                  }`}
                >
                  {checkedInToday ? '✓' : '📅'}
                </button>
                <div className="text-center">
                  <div className={`text-sm font-medium ${checkedInToday ? 'text-emerald-300' : 'text-amber-100'}`}>
                    {checkedInToday ? '今日已签到' : '点击签到'}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    已连续签到 {checkInStreak} 天
                  </div>
                </div>
              </div>

              {/* 签到奖励日历 */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 text-xs font-medium text-slate-300">连续签到奖励</div>
                <div className="flex items-center justify-between gap-1">
                  {CHECKIN_REWARDS.map((reward, i) => {
                    const day = i + 1
                    const done = day <= checkInStreak
                    const isToday = day === checkInStreak + 1 && !checkedInToday
                    return (
                      <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold ${
                            done
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : isToday
                              ? 'border-amber-400/50 bg-amber-400/15 text-amber-100 animate-pulse'
                              : 'border-white/10 bg-white/[0.03] text-slate-500'
                          }`}
                        >
                          {done ? '✓' : `+${reward}`}
                        </div>
                        <span className="text-[10px] text-slate-500">第{day}天</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 积分记录 */}
          {records.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium text-slate-400">最近记录</div>
              <div className="space-y-1.5">
                {records.slice(0, 8).map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2">
                    <span className="text-xs text-slate-300">{record.description}</span>
                    <span className={`text-xs font-semibold tabular-nums ${record.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {record.amount > 0 ? '+' : ''}{record.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 免费积分行 ──────────────────────────────────────────────────────────────

function FreePointsRow({
  icon,
  label,
  reward,
  actionLabel,
  onClick,
}: {
  icon: string
  label: string
  reward: string
  actionLabel: string
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-slate-300">{label}</span>
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
          {reward}
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-400/20 transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  )
}

// ─── 积分余额角标 ────────────────────────────────────────────────────────────

export function PointsBadge({ onClick }: { onClick: () => void }) {
  const { balance } = usePoints()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/20 transition-colors"
    >
      💎 {balance}
    </button>
  )
}

// ─── 积分消耗按钮 ────────────────────────────────────────────────────────────

interface PointsButtonProps {
  cost: number
  label: string
  onConsume: () => void
  onInsufficient: () => void
  className?: string
  disabled?: boolean
}

export function PointsButton({ cost, label, onConsume, onInsufficient, className, disabled }: PointsButtonProps) {
  const { balance } = usePoints()
  const sufficient = balance >= cost

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (sufficient) {
          onConsume()
        } else {
          onInsufficient()
        }
      }}
      className={`relative overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all ${
        sufficient
          ? 'border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.15),0_0_20px_rgba(251,191,36,0.1)] hover:bg-amber-400/25 active:scale-[0.98]'
          : 'border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
      } ${className ?? ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="flex items-center gap-2">
        <span>💎 {cost}</span>
        <span className="h-3 w-px bg-white/20" />
        <span>{sufficient ? label : '积分不足，去充值'}</span>
      </span>
    </button>
  )
}
