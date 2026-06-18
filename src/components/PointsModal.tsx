import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import { usePoints } from '../lib/PointsContext'
import { getInviteStats } from '../lib/points'
import { getMembershipInfo, MEMBERSHIP_PLANS, clearMembershipCache, type MembershipInfo } from '../lib/membership'
import { supabase } from '../lib/supabase'

// ─── 支付工具函数 ─────────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function createOrder(planId: string, payType: 'native' | 'h5') {
  const token = await getToken()
  if (!token) throw new Error('未登录')
  const res = await fetch('/api/pay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ planId, payType }),
  })
  const data = await res.json() as { error?: string; outTradeNo?: string; codeUrl?: string; h5Url?: string }
  if (!res.ok) throw new Error(data.error ?? '下单失败')
  return data
}

async function queryOrder(outTradeNo: string): Promise<{ tradeState: string; isMember: boolean }> {
  const token = await getToken()
  if (!token) throw new Error('未登录')
  const res = await fetch(`/api/pay/query-order?outTradeNo=${outTradeNo}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const data = await res.json() as { tradeState?: string; isMember?: boolean; error?: string }
  if (!res.ok) throw new Error(data.error ?? '查询失败')
  return { tradeState: data.tradeState ?? 'NOTPAY', isMember: data.isMember ?? false }
}

// ─── 常规购买套餐（积分充值） ─────────────────────────────────────────────────
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

  // 购买 toast（积分充值占位）
  const [buyToast, setBuyToast] = useState(false)

  // 会员状态
  const [memberInfo, setMemberInfo] = useState<MembershipInfo | null>(null)
  const [memberLoading, setMemberLoading] = useState(false)

  // 支付弹窗状态
  const [payState, setPayState] = useState<'idle' | 'creating' | 'polling' | 'success' | 'error'>('idle')
  const [payError, setPayError] = useState('')
  const [codeUrl, setCodeUrl] = useState('')           // Native 二维码 URL
  const [_currentTradeNo, setCurrentTradeNo] = useState('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isWxBrowser, setIsWxBrowser] = useState(false)

  useEffect(() => {
    setIsWxBrowser(/MicroMessenger/i.test(navigator.userAgent))
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // 打开时加载邀请数据 + 会员状态
  useEffect(() => {
    if (!open) return
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setInviteLink(`${window.location.origin}/?ref=${data.user.id}`)
    })
    getInviteStats().then(setInviteStats)
    // 加载会员状态
    setMemberLoading(true)
    getMembershipInfo(true).then((info) => {
      setMemberInfo(info)
    }).finally(() => setMemberLoading(false))
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

  // 会员套餐购买
  const handleMemberPlanClick = async (planId: string) => {
    setSelectedPlanId(planId)
    setPayState('creating')
    setPayError('')
    setCodeUrl('')
    stopPolling()

    try {
      // 微信内浏览器用 H5，其他用 Native 扫码
      const payType = isWxBrowser ? 'h5' : 'native'
      const result = await createOrder(planId, payType)

      if (payType === 'h5' && result.h5Url) {
        // H5：直接跳转，跳回后轮询
        const returnUrl = encodeURIComponent(`${window.location.href}?checkPay=${result.outTradeNo}`)
        window.location.href = `${result.h5Url}&redirect_url=${returnUrl}`
        setCurrentTradeNo(result.outTradeNo!)
        setPayState('polling')
        return
      }

      if (result.codeUrl) {
        setCodeUrl(result.codeUrl)
        setCurrentTradeNo(result.outTradeNo!)
        setPayState('polling')

        // 每3秒轮询一次，最多2分钟
        let tries = 0
        pollTimerRef.current = setInterval(async () => {
          tries++
          if (tries > 40) {
            stopPolling()
            setPayState('error')
            setPayError('支付超时，请重新尝试')
            return
          }
          try {
            const { tradeState, isMember } = await queryOrder(result.outTradeNo!)
            if (tradeState === 'SUCCESS' || isMember) {
              stopPolling()
              clearMembershipCache()
              getMembershipInfo(true).then(setMemberInfo)
              setPayState('success')
            }
          } catch { /* 静默，继续轮询 */ }
        }, 3000)
      }
    } catch (e: unknown) {
      setPayState('error')
      setPayError(e instanceof Error ? e.message : '创建订单失败')
    }
  }

  const handlePayClose = () => {
    stopPolling()
    setPayState('idle')
    setCodeUrl('')
    setSelectedPlanId(null)
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    await navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* 悬浮 Toast：积分充值占位提示 */}
      {createPortal(
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-[#1a1200] px-4 py-2.5 text-xs font-medium text-amber-200 shadow-lg shadow-black/40 transition-all duration-300 ${
          buyToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          积分充值购买链路建设中，请稍后再来～
        </div>,
        document.body
      )}

      {/* ── 会员支付弹窗（Portal 渲染，层级高于 PointsModal） ── */}
      {payState !== 'idle' && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handlePayClose} />
          <div className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">

            {/* 关闭按钮 */}
            <button type="button" onClick={handlePayClose}
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>

            {/* 套餐名称 */}
            <p className="mb-4 text-center text-sm font-semibold text-slate-200">
              {MEMBERSHIP_PLANS.find(p => p.id === selectedPlanId)?.label ?? '会员'}
              <span className="ml-2 text-amber-300">
                {MEMBERSHIP_PLANS.find(p => p.id === selectedPlanId)?.price}
              </span>
            </p>

            {/* 创建中 */}
            {payState === 'creating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-xs text-slate-400">正在生成支付码…</p>
              </div>
            )}

            {/* 二维码轮询中 */}
            {payState === 'polling' && codeUrl && (
              <div className="flex flex-col items-center gap-3">
                {/* 用 qr API 生成二维码图片 */}
                <div className="rounded-xl bg-white p-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(codeUrl)}`}
                    alt="微信支付二维码"
                    width={160} height={160}
                    className="block"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <p className="text-xs text-slate-400">打开微信扫一扫完成支付</p>
                </div>
                <p className="text-[10px] text-slate-600">支付后自动开通，无需操作</p>
              </div>
            )}

            {/* H5 跳转后等待 */}
            {payState === 'polling' && !codeUrl && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-xs text-slate-400">等待支付结果…</p>
                <p className="text-[10px] text-slate-600">完成支付后自动刷新</p>
              </div>
            )}

            {/* 支付成功 */}
            {payState === 'success' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-200">支付成功！</p>
                <p className="text-xs text-slate-400">会员已开通，每日专属贴士已解锁</p>
                <button type="button" onClick={handlePayClose}
                  className="mt-2 w-full rounded-xl bg-amber-400/20 border border-amber-400/30 py-2 text-sm font-medium text-amber-200 hover:bg-amber-400/30 transition-colors">
                  开始使用
                </button>
              </div>
            )}

            {/* 支付失败/超时 */}
            {payState === 'error' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30">
                  <svg className="h-7 w-7 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="10"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-200">支付失败</p>
                <p className="text-xs text-slate-400 text-center">{payError}</p>
                <button type="button"
                  onClick={() => selectedPlanId && handleMemberPlanClick(selectedPlanId)}
                  className="mt-2 w-full rounded-xl bg-amber-400/20 border border-amber-400/30 py-2 text-sm font-medium text-amber-200 hover:bg-amber-400/30 transition-colors">
                  重新尝试
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

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
            <div className="p-4 space-y-5">

              {/* ── 会员套餐区块 ── */}
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">每日专属贴士会员</span>
                  {memberLoading ? (
                    <span className="text-[10px] text-slate-500 animate-pulse">查询中…</span>
                  ) : memberInfo?.isMember ? (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-300">
                      ✓ 有效至 {memberInfo.expiresAt?.toLocaleDateString('zh-CN')}（剩 {memberInfo.daysLeft} 天）
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                      未开通
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {MEMBERSHIP_PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleMemberPlanClick(plan.id)}
                      className={`relative flex flex-col rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                        plan.highlight
                          ? 'border-amber-400/50 bg-amber-400/8 hover:bg-amber-400/12'
                          : 'border-[#333] bg-[#1a1a1a] hover:border-amber-400/25 hover:bg-[#1e1e1e]'
                      }`}
                    >
                      {plan.badge && (
                        <span className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          plan.highlight ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-slate-300'
                        }`}>
                          {plan.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mb-1">
                        <svg className="h-3.5 w-3.5 text-amber-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <div className={`text-lg font-bold ${plan.highlight ? 'text-amber-300' : 'text-amber-300'}`}>{plan.price}</div>
                      <div className="mt-0.5 text-xs font-medium text-slate-200">{plan.label}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{plan.duration} 天</div>
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
                  会员权益：每日根据你的八字五行生成专属建议，每天自动刷新 · 会员期内无限查看
                </p>
              </div>

              {/* 分割线 */}
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-white/8" />
                <span className="text-[10px] text-slate-600">积分充值</span>
                <div className="flex-1 border-t border-white/8" />
              </div>

              {/* ── 积分充值区块 ── */}
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
    </>
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
