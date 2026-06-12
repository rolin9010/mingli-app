import { useState, useEffect } from 'react'
import type React from 'react'
import { usePoints } from '../lib/PointsContext'
import { getInviteStats } from '../lib/points'
import { supabase } from '../lib/supabase'

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
  const { balance, checkedInToday, loading, doCheckIn, records } = usePoints()
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const [checkingIn, setCheckingIn] = useState(false)

  // 邀请统计
  const [inviteStats, setInviteStats] = useState<{ count: number; totalPoints: number } | null>(null)
  const [inviteLink, setInviteLink] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // 购买 toast
  const [buyToast, setBuyToast] = useState(false)

  // 打开时加载邀请数据
  useEffect(() => {
    if (!open) return
    // 获取当前用户 ID 拼接邀请链接
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setInviteLink(`${window.location.origin}/?ref=${data.user.id}`)
      }
    })
    getInviteStats().then(setInviteStats)
  }, [open])

  if (!open) return null

  const handleCheckIn = async () => {
    setCheckingIn(true)
    await doCheckIn()
    setCheckingIn(false)
  }

  const handleBuyClick = () => {
    setBuyToast(true)
    setTimeout(() => setBuyToast(false), 3000)
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    await navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            {loading ? (
              <span className="text-5xl font-bold tabular-nums text-amber-300/40 tracking-tight animate-pulse">--</span>
            ) : (
              <span className="text-5xl font-bold tabular-nums text-amber-300 tracking-tight">{balance}</span>
            )}
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
                  disabled={checkedInToday || checkingIn}
                  onClick={() => void handleCheckIn()}
                  className={`w-full rounded-xl py-3 text-xs font-semibold transition-all ${
                    checkedInToday
                      ? 'bg-emerald-600/25 border border-emerald-500/30 text-emerald-300'
                      : checkingIn
                        ? 'bg-amber-400/10 border border-amber-400/20 text-amber-300/60 animate-pulse'
                        : 'bg-amber-400/15 border border-amber-400/30 text-amber-100 hover:bg-amber-400/25 active:scale-[0.98]'
                  }`}
                >
                  {checkedInToday ? '✓ 今日已签到' : checkingIn ? '签到中…' : '📅 立即签到'}
                </button>
              </div>
            </div>
          )}

          {/* 赚积分 */}
          {tab === 'earn' && (
            <div className="p-4">
              <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] p-4 space-y-4">

                {/* 说明 */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/10 border border-amber-400/20">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 mb-1">邀请好友注册</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      每邀请 1 位新用户注册，<span className="text-amber-300 font-semibold">双方各得 3 积分</span>。
                    </p>
                  </div>
                </div>

                {/* 邀请链接 */}
                <div>
                  <div className="text-[11px] text-slate-500 mb-1.5">你的专属邀请链接</div>
                  <div className="rounded-xl border border-white/8 bg-[#111] p-3 flex items-center gap-2">
                    <span className="flex-1 truncate text-[11px] text-slate-400 font-mono">
                      {inviteLink || `${window.location.origin}/?ref=...`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      disabled={!inviteLink}
                      className={`shrink-0 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all ${
                        copied
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-amber-400/25 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 disabled:opacity-40'
                      }`}
                    >
                      {copied ? (
                        <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>已复制</>
                      ) : (
                        <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>复制</>
                      )}
                    </button>
                  </div>
                </div>

                {/* 统计数字 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
                    <div className="text-[11px] text-slate-500 mb-1">已邀请注册</div>
                    <div className="text-xl font-bold text-slate-200">
                      {inviteStats === null ? <span className="animate-pulse text-slate-600">--</span> : inviteStats.count}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
                    <div className="text-[11px] text-slate-500 mb-1">累计赚取积分</div>
                    <div className="text-xl font-bold text-amber-300">
                      {inviteStats === null ? <span className="animate-pulse text-slate-600">--</span> : `+${inviteStats.totalPoints}`}
                    </div>
                  </div>
                </div>

                {/* 使用说明 */}
                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed">
                  💡 对方通过你的链接访问并完成注册后，积分将自动发放。每位用户只能被邀请一次。
                </div>

              </div>
            </div>
          )}

          {/* 购买 */}
          {tab === 'buy' && (
            <div className="p-4 space-y-3">
              {/* Toast 提示 */}
              <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all duration-300 ${
                buyToast
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-200 opacity-100 translate-y-0'
                  : 'border-transparent bg-transparent text-transparent opacity-0 -translate-y-1 pointer-events-none'
              }`}>
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                购买链路建设中，请稍后再来～
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {RECHARGE_PACKS.map((pack) => (
                  <button
                    key={pack.points}
                    type="button"
                    onClick={handleBuyClick}
                    className="relative flex flex-col rounded-2xl border border-[#333] bg-[#1a1a1a] p-3 text-left transition-all hover:border-amber-400/30 hover:bg-[#1e1e1e] active:scale-[0.98]"
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
