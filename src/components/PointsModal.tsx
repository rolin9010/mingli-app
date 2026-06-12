import { useState } from 'react'
import type React from 'react'
import { usePoints } from '../lib/PointsContext'

// ─── 常规购买套餐（参考图） ───────────────────────────────────────────────────
const RECHARGE_PACKS = [
  { points: 3,   price: '¥3',   unit: '1.00' },
  { points: 8,   price: '¥7',   unit: '0.88' },
  { points: 22,  price: '¥18',  unit: '0.82' },
  { points: 38,  price: '¥30',  unit: '0.79' },
  { points: 90,  price: '¥68',  unit: '0.76' },
  { points: 180, price: '¥128', unit: '0.71' },
]

// ─── 4 个 Tab ────────────────────────────────────────────────────────────────
type TabKey = 'checkin' | 'earn' | 'buy' | 'records'

interface PointsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: TabKey
}

// ─── Tab 图标（SVG，对应参考图） ─────────────────────────────────────────────
function IconCheckin() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )
}
function IconEarn() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function IconBuy() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/>
    </svg>
  )
}
function IconRecords() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

const TABS: { key: TabKey; label: string; Icon: React.FC }[] = [
  { key: 'checkin', label: '签到',   Icon: IconCheckin },
  { key: 'earn',    label: '赚积分', Icon: IconEarn    },
  { key: 'buy',     label: '购买',   Icon: IconBuy     },
  { key: 'records', label: '记录',   Icon: IconRecords },
]

// ─── 积分图标 ─────────────────────────────────────────────────────────────────
function CoinIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'
  return (
    <svg className={`${s} text-amber-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" fillOpacity="0.25"/>
    </svg>
  )
}

// ─── 主弹窗 ──────────────────────────────────────────────────────────────────
export default function PointsModal({ open, onClose, defaultTab = 'checkin' }: PointsModalProps) {
  const { balance, checkedInToday, doCheckIn, doRecharge, records } = usePoints()
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#111] shadow-2xl">

        {/* ── 标题栏 ── */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2000] border border-amber-400/30">
              <CoinIcon size="sm" />
            </div>
            <span className="text-base font-semibold text-white">积分中心</span>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 积分余额 ── */}
        <div className="bg-[#1c1800] mx-0 px-5 py-5 text-center">
          <div className="text-xs text-slate-400 mb-2">当前积分</div>
          <div className="flex items-center justify-center gap-2">
            <CoinIcon size="lg" />
            <span className="text-5xl font-bold tabular-nums text-amber-300 tracking-tight">{balance}</span>
            <span className="text-sm text-slate-400 mt-3">积分</span>
          </div>
        </div>

        {/* ── Tab 栏 ── */}
        <div className="flex border-b border-white/8 bg-[#111]">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3.5 text-xs font-medium transition-colors ${
                tab === key ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon />
              <span>{label}</span>
              {tab === key && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab 内容 ── */}
        <div className="max-h-[56vh] overflow-y-auto bg-[#111]">

          {/* 签到 */}
          {tab === 'checkin' && (
            <div className="p-4">
              <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20">
                    <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
                      <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">每日签到</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">每天签到获得1积分</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checkedInToday}
                  onClick={() => doCheckIn()}
                  className={`w-full rounded-xl py-3 text-xs font-semibold transition-all ${
                    checkedInToday
                      ? 'bg-emerald-600/25 border border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-400/15 border border-amber-400/30 text-amber-100 hover:bg-amber-400/25 active:scale-[0.98]'
                  }`}
                >
                  {checkedInToday ? '✓ 今日已签到' : '📅 立即签到'}
                </button>
              </div>
            </div>
          )}

          {/* 赚积分 */}
          {tab === 'earn' && (
            <div className="p-4">
              <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] p-4">
                {/* 说明文字 */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/10 border border-amber-400/20">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    每邀请 1 位新用户注册，您和对方都可额外获得 <span className="font-bold text-amber-300">3</span> 积分。
                  </p>
                </div>

                {/* 邀请链接 */}
                <div className="rounded-xl border border-white/8 bg-[#111] p-3 flex items-center gap-2 mb-3">
                  <span className="flex-1 truncate text-xs text-slate-400 font-mono">
                    {window.location.origin}/?ref=invite
                  </span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(window.location.origin + '/?ref=invite')}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-400/15 border border-amber-400/25 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-400/25 transition-colors"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    复制
                  </button>
                </div>

                {/* 统计数字 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
                    <div className="text-[11px] text-slate-500 mb-1">已邀请注册</div>
                    <div className="text-xl font-bold text-slate-200">0</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
                    <div className="text-[11px] text-slate-500 mb-1">累计赚取积分</div>
                    <div className="text-xl font-bold text-slate-200">0</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 购买 */}
          {tab === 'buy' && (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2.5">
                {RECHARGE_PACKS.map((pack) => (
                  <button
                    key={pack.points}
                    type="button"
                    disabled={recharging !== null}
                    onClick={() => void handleRecharge(pack.points)}
                    className={`relative flex flex-col rounded-2xl border border-[#333] bg-[#1a1a1a] p-3 text-left transition-all hover:border-amber-400/30 hover:bg-[#1e1e1e] active:scale-[0.98] ${
                      recharging === pack.points ? 'opacity-60 animate-pulse' : ''
                    }`}
                  >
                    <CoinIcon size="sm" />
                    <div className="mt-2 text-lg font-bold text-amber-300">{pack.price}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-200">{pack.points} 积分</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">¥{pack.unit}/积分</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 记录 */}
          {tab === 'records' && (
            <div className="px-4 pb-4">
              {records.length === 0 ? (
                <div className="py-14 text-center text-sm text-slate-600">暂无积分记录</div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between py-4">
                      <div>
                        <div className="text-xs text-slate-200">{record.description}</div>
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {new Date(record.createdAt).toLocaleString('zh-CN', {
                            year: 'numeric', month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </div>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${record.amount > 0 ? 'text-amber-300' : 'text-rose-400'}`}>
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#1a1a1a] py-3.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            立即联系客服
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 积分角标（供报告页使用） ─────────────────────────────────────────────────
export function PointsBadge({ onClick }: { onClick: () => void }) {
  const { balance } = usePoints()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/20 transition-colors"
    >
      <svg className="h-3 w-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3"/>
      </svg>
      {balance} 积分
    </button>
  )
}
