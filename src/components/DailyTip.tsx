import { useEffect, useRef, useState } from 'react'
import { buildDailyTipPrompt, fetchDailyTip } from '../lib/ai'
import { computeAiReportFingerprint } from '../lib/aiReportCache'
import type { ReportResults, UserInput } from '../lib/types'

// ── 贴士缓存（localStorage，按日期+用户指纹区分） ──────────────────────────

function getTipCacheKey(input: UserInput, dateStr: string): string {
  const fp = computeAiReportFingerprint(input)
  return `daily_tip_${fp}_${dateStr}`
}

function getCachedTip(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setCachedTip(key: string, tip: string): void {
  try {
    localStorage.setItem(key, tip)
  } catch { /* 静默 */ }
}

// ── 获取今日农历日期字符串（含干支） ─────────────────────────────────────

function getTodayDateStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}年${m}月${day}日`
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
}: {
  input: UserInput
  results: ReportResults
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

  // 自动在组件挂载时加载（如无缓存）
  useEffect(() => {
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
        setError(e instanceof Error ? e.message : '生成失败')
        setPhase('error')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

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
          {/* 光点装饰 */}
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dominantEl === '木' ? 'bg-emerald-400' : dominantEl === '火' ? 'bg-rose-400' : dominantEl === '土' ? 'bg-amber-400' : dominantEl === '金' ? 'bg-yellow-300' : 'bg-sky-400'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${dominantEl === '木' ? 'bg-emerald-400' : dominantEl === '火' ? 'bg-rose-400' : dominantEl === '土' ? 'bg-amber-400' : dominantEl === '金' ? 'bg-yellow-300' : 'bg-sky-400'}`} />
          </span>
          <span className={`text-xs font-semibold tracking-wider ${colors.text}`}>五行贴士 · 今日</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">
            {todayStr}
          </span>
        </div>

        {/* 刷新按钮 */}
        {phase === 'done' && (
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

      {/* 内容区 */}
      {phase === 'loading' && <TipSkeleton />}

      {phase === 'error' && (
        <div className="flex items-center gap-2 text-xs text-rose-300/80">
          <span>加载失败：{error}</span>
          <button type="button" onClick={handleRefresh} className="underline hover:text-rose-200">
            重试
          </button>
        </div>
      )}

      {phase === 'done' && tip && (
        <div className="relative">
          <p
            className={`text-sm leading-relaxed text-slate-200/90 transition-all ${
              !expanded ? 'line-clamp-3' : ''
            }`}
          >
            {tip}
          </p>
          {/* 展开/收起 */}
          {tip.length > 80 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`mt-1 text-[11px] transition-colors ${colors.text} opacity-70 hover:opacity-100`}
            >
              {expanded ? '收起 ↑' : '展开全文 ↓'}
            </button>
          )}
        </div>
      )}

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
