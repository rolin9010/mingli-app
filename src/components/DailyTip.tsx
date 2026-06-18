import { useEffect, useRef, useState } from 'react'
import { buildDailyTipPrompt, fetchDailyTip } from '../lib/ai'
import { computeAiReportFingerprint } from '../lib/aiReportCache'
import { getMembershipInfo, type MembershipInfo } from '../lib/membership'
import type { ReportResults, UserInput } from '../lib/types'

// ── 贴士缓存（localStorage，按日期+用户指纹区分） ──────────────────────────

function getTipCacheKey(input: UserInput, dateStr: string): string {
  const fp = computeAiReportFingerprint(input)
  return `daily_tip_${fp}_${dateStr}`
}

function getCachedTip(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function setCachedTip(key: string, tip: string): void {
  try { localStorage.setItem(key, tip) } catch { /* 静默 */ }
}

// ── 获取今日日期字符串 ─────────────────────────────────────────────────

function getTodayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── 静态通用贴士（非会员展示，按主五行区分） ─────────────────────────────

const STATIC_TIPS: Record<string, string> = {
  木: '木气主生发，今日宜走出户外感受自然气息，舒展筋脉。清晨迎着阳光散步十分钟，让肝气得以舒畅条达。保持情绪平和，避免压抑烦闷，是木行人今日最重要的养生功课。🌿',
  火: '火气主礼明，今日心神宜静不宜躁。午间小憩片刻，让心气得以收敛。饮一杯温热的红枣茶，或做几组缓慢的深呼吸，让体内的阳气在流动中归位，不要让兴奋过头耗散精气。🔥',
  土: '土气主信厚，今日适合做有条理、踏实落地的事情。整理一下桌面或房间，把悬而未决的小事逐一了结，让脾胃之气得以运化顺畅。饮食规律、不贪凉，是今日最实用的养护。🌍',
  金: '金气主收敛，今日宜少言多行，把注意力放在一件事上做到位。深长的呼吸练习（吸气4秒、屏息2秒、呼气6秒）有助于肺气清肃。避免悲忧情绪，保持内心宁静清明。✨',
  水: '水气主藏智，今日宜早睡早起，保护肾精。避免过度消耗体力和脑力，给自己留出静思冥想的时间。一杯温热的黑豆水或核桃粥，为你的肾气添一份滋养。💧',
}

// ── 五行元素颜色配置 ──────────────────────────────────────────────────────

const ELEMENT_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  木: { bg: 'bg-emerald-950/60', border: 'border-emerald-500/30', text: 'text-emerald-200', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.12)]' },
  火: { bg: 'bg-red-950/60', border: 'border-rose-500/30', text: 'text-rose-200', glow: 'shadow-[0_0_20px_rgba(251,113,133,0.12)]' },
  土: { bg: 'bg-amber-950/60', border: 'border-amber-500/30', text: 'text-amber-200', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.12)]' },
  金: { bg: 'bg-yellow-950/50', border: 'border-yellow-500/30', text: 'text-yellow-100', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.1)]' },
  水: { bg: 'bg-slate-950/80', border: 'border-sky-600/30', text: 'text-sky-200', glow: 'shadow-[0_0_20px_rgba(56,189,248,0.12)]' },
}

function getDominantElement(results: ReportResults): string {
  const elements = results?.bazi?.elements
  if (!elements?.length) return '火'
  return elements.reduce((a, b) => (b.percent > a.percent ? b : a)).element
}

// ── 骨架屏动画 ────────────────────────────────────────────────────────────

function TipSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-white/10" />
      <div className="h-3.5 w-full animate-pulse rounded-full bg-white/10" />
      <div className="h-3.5 w-5/6 animate-pulse rounded-full bg-white/10" />
      <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-white/8" />
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────

export default function DailyTip({
  input,
  results,
  onOpenMembership,
}: {
  input: UserInput
  results: ReportResults
  /** 点击「开通会员」时调用，打开积分中心/购买弹窗 */
  onOpenMembership?: () => void
}) {
  const todayStr = getTodayDateStr()
  const cacheKey = getTipCacheKey(input, todayStr)
  const dominantEl = getDominantElement(results)
  const colors = ELEMENT_COLORS[dominantEl] ?? ELEMENT_COLORS['火']!

  const [tip, setTip] = useState<string>(() => getCachedTip(cacheKey) ?? '')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    getCachedTip(cacheKey) ? 'done' : 'idle',
  )
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const hasFetched = useRef(false)

  // 会员状态
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [memberChecked, setMemberChecked] = useState(false)

  // 非会员展示静态通用贴士
  const staticTip = STATIC_TIPS[dominantEl] ?? STATIC_TIPS['火']!

  // 检查会员状态
  useEffect(() => {
    getMembershipInfo().then((info) => {
      setMembership(info)
      setMemberChecked(true)
    }).catch(() => {
      setMembership({ isMember: false, plan: null, expiresAt: null, daysLeft: null })
      setMemberChecked(true)
    })
  }, [])

  // 会员确认后，若有缓存直接展示；否则拉 AI
  useEffect(() => {
    if (!memberChecked || !membership?.isMember) return
    if (hasFetched.current) return
    const cached = getCachedTip(cacheKey)
    if (cached) {
      setTip(cached)
      setPhase('done')
      return
    }
    hasFetched.current = true
    setPhase('loading')
    const prompt = buildDailyTipPrompt(input, results, todayStr)
    fetchDailyTip(prompt)
      .then((text) => {
        setTip(text.trim())
        setCachedTip(cacheKey, text.trim())
        setPhase('done')
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : '生成失败'
        // 如果是非会员错误，让会员检查结果兜底
        if (msg.includes('NOT_MEMBER') || msg.includes('需要开通会员')) {
          setMembership({ isMember: false, plan: null, expiresAt: null, daysLeft: null })
        } else {
          setError(msg)
          setPhase('error')
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberChecked, membership?.isMember, cacheKey])

  const handleRefresh = () => {
    try { localStorage.removeItem(cacheKey) } catch { /* 静默 */ }
    hasFetched.current = true
    setPhase('loading')
    setError('')
    const prompt = buildDailyTipPrompt(input, results, todayStr)
    fetchDailyTip(prompt)
      .then((text) => {
        setTip(text.trim())
        setCachedTip(cacheKey, text.trim())
        setPhase('done')
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '生成失败')
        setPhase('error')
      })
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-5 py-4 transition-all ${colors.bg} ${colors.border} ${colors.glow}`}
    >
      {/* 顶部标题行 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dominantEl === '木' ? 'bg-emerald-400' : dominantEl === '火' ? 'bg-rose-400' : dominantEl === '土' ? 'bg-amber-400' : dominantEl === '金' ? 'bg-yellow-300' : 'bg-sky-400'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${dominantEl === '木' ? 'bg-emerald-400' : dominantEl === '火' ? 'bg-rose-400' : dominantEl === '土' ? 'bg-amber-400' : dominantEl === '金' ? 'bg-yellow-300' : 'bg-sky-400'}`} />
          </span>
          <span className={`text-xs font-semibold tracking-wider ${colors.text}`}>五行贴士 · 今日</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">
            {todayStr}
          </span>
          {/* 会员专属标识 */}
          {membership?.isMember && (
            <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              专属
            </span>
          )}
        </div>

        {/* 刷新按钮（仅会员且加载完成后显示） */}
        {membership?.isMember && phase === 'done' && (
          <button
            type="button"
            onClick={handleRefresh}
            title="换一条"
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.49" />
            </svg>
          </button>
        )}
      </div>

      {/* ── 非会员：静态通用贴士 + 升级入口 ── */}
      {memberChecked && !membership?.isMember && (
        <>
          <p className="text-sm leading-relaxed text-slate-200/90 line-clamp-3">
            {staticTip}
          </p>
          {/* 升级解锁横幅 */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-amber-200">解锁专属每日贴士</p>
              <p className="mt-0.5 text-[10px] text-slate-400 leading-relaxed">
                开通会员，每天根据你的八字五行生成专属建议
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMembership}
              className="shrink-0 rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/25 transition-colors whitespace-nowrap"
            >
              ¥1 试用7天 →
            </button>
          </div>
        </>
      )}

      {/* ── 会员：加载中 ── */}
      {membership?.isMember && phase === 'loading' && <TipSkeleton />}

      {/* ── 会员：加载失败 ── */}
      {membership?.isMember && phase === 'error' && (
        <div className="flex items-center gap-2 text-xs text-rose-300/80">
          <span>加载失败：{error}</span>
          <button type="button" onClick={handleRefresh} className="underline hover:text-rose-200">
            重试
          </button>
        </div>
      )}

      {/* ── 会员：贴士内容 ── */}
      {membership?.isMember && phase === 'done' && tip && (
        <div className="relative">
          <p className={`text-sm leading-relaxed text-slate-200/90 transition-all ${!expanded ? 'line-clamp-3' : ''}`}>
            {tip}
          </p>
          {tip.length > 80 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`mt-1 text-[11px] transition-colors ${colors.text} opacity-70 hover:opacity-100`}
            >
              {expanded ? '收起 ↑' : '展开全文 ↓'}
            </button>
          )}
          {/* 会员到期提示 */}
          {membership.daysLeft !== null && membership.daysLeft <= 3 && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-400/20 bg-rose-400/8 px-2.5 py-1.5">
              <span className="text-[10px] text-rose-300/80">
                会员将于 {membership.daysLeft} 天后到期
              </span>
              <button
                type="button"
                onClick={onOpenMembership}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline"
              >
                立即续费
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 初始未检查状态：显示骨架 ── */}
      {!memberChecked && <TipSkeleton />}

      {/* 装饰性背景光晕 */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.06] blur-2xl"
        style={{
          background:
            dominantEl === '木' ? 'rgb(52,211,153)' :
            dominantEl === '火' ? 'rgb(251,113,133)' :
            dominantEl === '土' ? 'rgb(245,158,11)' :
            dominantEl === '金' ? 'rgb(250,204,21)' :
            'rgb(56,189,248)',
        }}
      />
    </div>
  )
}
