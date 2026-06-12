import { useState } from 'react'
import { usePoints } from '../lib/PointsContext'

// ─── 充值套餐 ────────────────────────────────────────────────────────────────
const RECHARGE_PACKS = [
  { points: 10, price: '¥9.9',  unit: '0.99', popular: false },
  { points: 30, price: '¥25',   unit: '0.83', popular: true  },
  { points: 100, price: '¥68',  unit: '0.68', popular: false },
  { points: 300, price: '¥168', unit: '0.56', popular: false },
]

const CHECKIN_REWARDS = [1, 2, 3, 4, 5]

// ─── 积分中心弹窗（4 Tab：签到 / 赚积分 / 购买 / 记录） ─────────────────────

type TabKey = 'checkin' | 'earn' | 'buy' | 'records'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'checkin', label: '签到',   icon: '📅' },
  { key: 'earn',    label: '赚积分', icon: '🎁' },
  { key: 'buy',     label: '购买',   icon: '🛒' },
  { key: 'records', label: '记录',   icon: '📋' },
]

interface PointsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: TabKey
}

export default function PointsModal({ open, onClose, defaultTab = 'checkin' }: PointsModalProps) {
  const { balance, checkedInToday, checkInStreak, doCheckIn, doRecharge, records } = usePoints()
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const [recharging, setRecharging] = useState<number | null>(null)

  if (!open) return null

  const handleRecharge = async (points: number) => {
    setRecharging(points)
    await new Promise((r) => setTimeout(r, 800))
    doRecharge(points)
    setRecharging(null)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗主体 */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl">

        {/* ── 顶部标题栏 ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 border border-amber-400/30">
              <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 6v6l4 2"/>
                <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.4"/>
              </svg>
            </div>
            <span className="text-base font-semibold text-white">积分中心</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:bg-white/15 hover:text-slate-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 积分余额展示 ── */}
        <div className="bg-gradient-to-b from-[#1a1500]/80 to-transparent px-5 py-5 text-center">
          <div className="text-xs text-slate-400 mb-1.5">当前积分</div>
          <div className="flex items-center justify-center gap-2">
            <svg className="h-8 w-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25"/>
            </svg>
            <span className="text-5xl font-bold tabular-nums text-amber-300 tracking-tight">{balance}</span>
            <span className="text-base text-slate-400 mt-2">积分</span>
          </div>
        </div>

        {/* ── Tab 栏 ── */}
        <div className="flex border-b border-white/8">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-amber-400 text-amber-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab 内容 ── */}
        <div className="max-h-[55vh] overflow-y-auto">

          {/* 签到 */}
          {tab === 'checkin' && (
            <div className="p-4 space-y-3">
              {/* 每日签到卡片 */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-100">每日签到</div>
                    <div className="text-xs text-slate-500">每天签到获得 1~5 积分</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checkedInToday}
                  onClick={() => doCheckIn()}
                  className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all ${
                    checkedInToday
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-400/15 border border-amber-400/30 text-amber-100 hover:bg-amber-400/25 active:scale-[0.98]'
                  }`}
                >
                  {checkedInToday ? '✓ 今日已签到' : '📅 立即签到'}
                </button>
              </div>

              {/* 连续签到进度 */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-300">连续签到奖励</span>
                  <span className="text-xs text-slate-500">已连续 {checkInStreak} 天</span>
                </div>
                <div className="flex gap-1.5">
                  {CHECKIN_REWARDS.map((reward, i) => {
                    const day = i + 1
                    const done = day <= checkInStreak
                    const isNext = day === checkInStreak + 1 && !checkedInToday
                    return (
                      <div key={day} className="flex flex-1 flex-col items-center gap-1">
                        <div className={`flex h-9 w-full items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                          done ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : isNext ? 'border-amber-400/40 bg-amber-400/10 text-amber-200 animate-pulse'
                          : 'border-white/8 bg-white/[0.02] text-slate-600'
                        }`}>
                          {done ? '✓' : `+${reward}`}
                        </div>
                        <span className="text-[9px] text-slate-600">第{day}天</span>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* 赚积分 */}
          {tab === 'earn' && (
            <div className="p-4 space-y-3">
              <EarnRow
                icon={<svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
                title="邀请好友"
                desc="每成功邀请一位好友注册"
                reward="+3 积分"
                action="复制邀请链接"
                onAction={() => {
                  void navigator.clipboard?.writeText(window.location.origin + '?ref=invite')
                }}
              />
              <EarnRow
                icon={<svg className="h-5 w-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                title="关注公众号"
                desc="关注「五行能量」公众号"
                reward="+5 积分"
                action="去关注"
                onAction={() => {/* TODO */}}
              />
              <EarnRow
                icon={<svg className="h-5 w-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>}
                title="每日签到连续 7 天"
                desc="连续签到 7 天额外奖励"
                reward="+10 积分"
                action="去签到"
                onAction={() => setTab('checkin')}
              />
            </div>
          )}

          {/* 购买 */}
          {tab === 'buy' && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">选择充值套餐，积分即时到账</p>
              <div className="grid grid-cols-2 gap-2.5">
                {RECHARGE_PACKS.map((pack) => (
                  <button
                    key={pack.points}
                    type="button"
                    disabled={recharging !== null}
                    onClick={() => void handleRecharge(pack.points)}
                    className={`relative flex flex-col items-center rounded-xl border py-4 px-2 transition-all ${
                      pack.popular
                        ? 'border-amber-400/50 bg-amber-400/8 shadow-[0_0_16px_rgba(251,191,36,0.08)]'
                        : 'border-white/8 bg-white/[0.02] hover:border-white/15'
                    } ${recharging === pack.points ? 'opacity-70 animate-pulse' : ''}`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                        推荐
                      </span>
                    )}
                    <div className="flex items-baseline gap-1 mb-1">
                      <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.3"/></svg>
                      <span className="text-2xl font-bold text-amber-200">{pack.points}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{pack.price}</span>
                    <span className="mt-0.5 text-[10px] text-slate-500">≈ ¥{pack.unit}/积分</span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-slate-500 text-center">
                支付接口接入中，充值后积分实时到账
              </div>
            </div>
          )}

          {/* 记录 */}
          {tab === 'records' && (
            <div className="p-4">
              {records.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-600">暂无积分记录</div>
              ) : (
                <div className="space-y-1.5">
                  {records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-3.5 py-3">
                      <div>
                        <div className="text-xs font-medium text-slate-200">{record.description}</div>
                        <div className="mt-0.5 text-[10px] text-slate-600">
                          {new Date(record.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${record.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {record.amount > 0 ? '+' : ''}{record.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 底部联系客服 ── */}
        <div className="border-t border-white/8 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            立即联系客服
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 赚积分行 ─────────────────────────────────────────────────────────────────

function EarnRow({
  icon,
  title,
  desc,
  reward,
  action,
  onAction,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  reward: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-xs font-bold text-emerald-400">{reward}</span>
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
        >
          {action}
        </button>
      </div>
    </div>
  )
}

// ─── 积分余额角标（供报告页使用） ────────────────────────────────────────────

export function PointsBadge({ onClick }: { onClick: () => void }) {
  const { balance } = usePoints()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/20 transition-colors"
    >
      <svg className="h-3 w-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3"/></svg>
      {balance} 积分
    </button>
  )
}

// ─── 类型补充 ─────────────────────────────────────────────────────────────────
import type React from 'react'
