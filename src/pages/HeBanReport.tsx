import { useMemo, useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  aiMarkdownComponents,
  normalizeAiReportMarkdown,
  parseAiOpeningBlocks,
} from '../lib/aiReportMarkdown'
import { buildHeBanPrompt, fetchHeBanAIReading } from '../lib/ai'
import { getCachedAiReport, setCachedAiReport, clearCachedAiReport } from '../lib/aiReportCache'
import { usePoints } from '../lib/PointsContext'
import { POINTS_COST } from '../lib/points'
import PointsModal, { PointsBadge } from '../components/PointsModal'
import type { HeBanUserInput, HeBanResults, BaziResult } from '../lib/types'
import { Step2ChartsSection } from './Step2Results'

// ── 合盘 AI Tab 定义 ───────────────────────────────────────────────
const HEBAN_TABS = [
  { key: 'greeting', label: '开篇',     icon: '✦' },
  { key: 'topic1',   label: '能量契合', icon: '☯' },
  { key: 'topic2',   label: '关系互动', icon: '💫' },
  { key: 'topic3',   label: '协作互补', icon: '🤝' },
  { key: 'topic4',   label: '成长方向', icon: '🌱' },
  { key: 'topic5',   label: '相处建议', icon: '🌙' },
] as const

type HeBanTabKey = (typeof HEBAN_TABS)[number]['key']

function parseHeBanTopics(markdown: string): Record<HeBanTabKey, string> {
  const normalized = normalizeAiReportMarkdown(markdown)
  const { headerNote, greeting, rest } = parseAiOpeningBlocks(normalized)

  const greetingParts: string[] = []
  if (headerNote) greetingParts.push(`*${headerNote}*`)
  if (greeting) greetingParts.push(greeting)

  const sections: Record<string, string> = {}
  const chineseNums: Record<string, string> = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5' }
  const topicRegex = /###\s*主题[一二三四五1-5][：:：]?[^\n]*/g
  const matches: { index: number; num: string }[] = []
  let m: RegExpExecArray | null
  while ((m = topicRegex.exec(rest)) !== null) {
    const numMatch = m[0].match(/主题([一二三四五1-5])/)
    if (!numMatch) continue
    const rawNum = numMatch[1]!
    matches.push({ index: m.index, num: chineseNums[rawNum] ?? rawNum })
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index
    const end = i + 1 < matches.length ? matches[i + 1]!.index : rest.length
    sections[matches[i]!.num] = rest.slice(start, end).trim()
  }

  return {
    greeting: greetingParts.join('\n\n') || '（AI 还未生成开篇内容）',
    topic1: sections['1'] ?? '',
    topic2: sections['2'] ?? '',
    topic3: sections['3'] ?? '',
    topic4: sections['4'] ?? '',
    topic5: sections['5'] ?? '',
  }
}

// ── 合盘指纹（区别于单人报告缓存） ────────────────────────────────
function computeHeBanFingerprint(input: HeBanUserInput): string {
  function djb2(s: string): string {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
    return `hb_${(h >>> 0).toString(16)}`
  }
  const payload = {
    v: 1,
    relation: input.relation,
    a: { name: input.personA.name.trim(), birth: input.personA.birth, gender: input.personA.gender, calendarType: input.personA.calendarType ?? '公历' },
    b: { name: input.personB.name.trim(), birth: input.personB.birth, gender: input.personB.gender, calendarType: input.personB.calendarType ?? '公历' },
  }
  return djb2(JSON.stringify(payload))
}

// ── 五行对比组件 ───────────────────────────────────────────────────
const WUXING_COLORS: Record<'木'|'火'|'土'|'金'|'水', { bar: string; text: string }> = {
  木: { bar: 'bg-emerald-500/70', text: 'text-emerald-300' },
  火: { bar: 'bg-rose-500/70',    text: 'text-rose-300'    },
  土: { bar: 'bg-amber-500/70',   text: 'text-amber-300'   },
  金: { bar: 'bg-yellow-400/70',  text: 'text-yellow-300'  },
  水: { bar: 'bg-sky-500/70',     text: 'text-sky-300'     },
}

function WuxingCompareBar({
  element, percentA, percentB,
}: {
  element: '木'|'火'|'土'|'金'|'水'
  percentA: number; percentB: number
  nameA: string; nameB: string
}) {
  const col = WUXING_COLORS[element]
  const maxVal = Math.max(percentA, percentB, 1)
  const barMaxPx = 72
  return (
    <div className="grid grid-cols-[1fr_2rem_1fr] items-center gap-2">
      {/* 甲方 bar（右对齐） */}
      <div className="flex items-center justify-end gap-1.5">
        <span className={`text-[11px] tabular-nums ${col.text}`}>{percentA.toFixed(1)}%</span>
        <div
          className={`h-3 rounded-l-full ${col.bar}`}
          style={{ width: `${Math.round((percentA / maxVal) * barMaxPx)}px`, minWidth: percentA > 0 ? 4 : 0 }}
        />
      </div>
      {/* 五行名 */}
      <div className={`text-center text-sm font-bold ${col.text}`}>{element}</div>
      {/* 乙方 bar（左对齐） */}
      <div className="flex items-center gap-1.5">
        <div
          className={`h-3 rounded-r-full ${col.bar}`}
          style={{ width: `${Math.round((percentB / maxVal) * barMaxPx)}px`, minWidth: percentB > 0 ? 4 : 0 }}
        />
        <span className={`text-[11px] tabular-nums ${col.text}`}>{percentB.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function WuxingCompare({ elementsA, elementsB, nameA, nameB }: {
  elementsA: BaziResult['elements']
  elementsB: BaziResult['elements']
  nameA: string; nameB: string
}) {
  const elOrder: ('木'|'火'|'土'|'金'|'水')[] = ['木','火','土','金','水']
  const mapA = Object.fromEntries(elementsA.map(e => [e.element, e.percent])) as Record<string, number>
  const mapB = Object.fromEntries(elementsB.map(e => [e.element, e.percent])) as Record<string, number>

  return (
    <div className="rounded-xl border border-amber-400/25 bg-black/25 p-4">
      <div className="mb-4 text-center text-sm font-semibold tracking-wide text-amber-200/90">五行能量对比</div>
      {/* 标题行 */}
      <div className="mb-3 grid grid-cols-[1fr_2rem_1fr] text-center text-xs text-slate-400">
        <span className="text-right pr-2">{nameA}</span>
        <span></span>
        <span className="text-left pl-2">{nameB}</span>
      </div>
      <div className="space-y-3">
        {elOrder.map((el) => (
          <WuxingCompareBar
            key={el}
            element={el}
            percentA={mapA[el] ?? 0}
            percentB={mapB[el] ?? 0}
            nameA={nameA}
            nameB={nameB}
          />
        ))}
      </div>
    </div>
  )
}

// ── 加载动画 ──────────────────────────────────────────────────────
function AiLoading({ estimatedSeconds }: { estimatedSeconds: number }) {
  const [remain, setRemain] = useState(estimatedSeconds)
  useEffect(() => {
    setRemain(estimatedSeconds)
    const id = window.setInterval(() => setRemain((r) => (r <= 0 ? 0 : r - 1)), 1000)
    return () => window.clearInterval(id)
  }, [estimatedSeconds])
  return (
    <div className="flex w-full flex-col items-start gap-4 py-10 text-left">
      <div className="relative h-20 w-20 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-amber-300/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-400" style={{ animationDuration: '1.2s' }} />
        <div className="absolute inset-3 rounded-full border border-amber-300/10" />
        <div className="absolute inset-3 animate-spin rounded-full border border-transparent border-t-amber-300/40" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
      </div>
      <div className="space-y-2">
        <p className="text-xl font-semibold tracking-wide text-amber-100 sm:text-2xl">AI 大师解读中</p>
        <p className="text-sm text-slate-300/90">
          {remain > 0 ? <>倒计时 {remain} 秒</> : <span className="text-amber-200/80">预计时间已到，仍在深度生成中…</span>}
        </p>
        <p className="text-xs leading-relaxed text-slate-400/90">正在结合双方四柱五行进行合盘分析...</p>
      </div>
    </div>
  )
}

// ── Tab 内容渲染 ──────────────────────────────────────────────────
function TabContent({ markdown }: { markdown: string }) {
  if (!markdown || markdown.trim() === '') {
    return <p className="py-6 text-center text-sm text-slate-400/80">该主题内容暂未解析到，请尝试重新生成报告。</p>
  }
  return (
    <div className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed" style={{ fontFamily: AI_READING_SERIF }}>
      <ReactMarkdown components={aiMarkdownComponents}>{markdown}</ReactMarkdown>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function HeBanReport({
  input,
  results,
  onAIReportComplete,
}: {
  input: HeBanUserInput
  results: HeBanResults
  onAIReportComplete?: (aiReport: string) => void | Promise<void>
}) {
  const baseFingerprint = useMemo(() => computeHeBanFingerprint(input), [input])
  const [readMode, setReadMode] = useState<'quick' | 'deep'>('quick')
  // 缓存 key 区分快速/深度
  const fingerprint = useMemo(() => `${baseFingerprint}_${readMode}`, [baseFingerprint, readMode])

  const { balance, doConsume } = usePoints()
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [aiContent, setAiContent] = useState(() => getCachedAiReport(`${computeHeBanFingerprint(input)}_quick`) ?? '')
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    getCachedAiReport(`${computeHeBanFingerprint(input)}_quick`) ? 'done' : 'idle',
  )
  const [aiError, setAiError] = useState('')
  const [aiLoadGen, setAiLoadGen] = useState(0)
  const [activeTab, setActiveTab] = useState<HeBanTabKey>('greeting')
  const tabTopRef = useRef<HTMLDivElement>(null)

  const switchTab = (key: HeBanTabKey) => {
    setActiveTab(key)
    setTimeout(() => {
      tabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }
  // 上半部分：切换双方测算的 Tab
  const [activePersonTab, setActivePersonTab] = useState<'A' | 'B'>('A')

  useEffect(() => {
    const id = 'mingli-font-noto-serif-sc'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id; link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;600;700&display=swap'
    document.head.appendChild(link)
  }, [])

  const topics = useMemo(() => aiContent ? parseHeBanTopics(aiContent) : null, [aiContent])

  // 模式切换时检查对应缓存
  useEffect(() => {
    const cached = getCachedAiReport(fingerprint)
    if (cached) {
      setAiContent(cached)
      setAiPhase('done')
      setAiError('')
    } else {
      setAiContent('')
      setAiPhase('idle')
      setAiError('')
    }
    setActiveTab('greeting')
  }, [fingerprint])

  const startAiReading = async (opts?: { force?: boolean }) => {
    if (opts?.force) clearCachedAiReport(fingerprint)
    else {
      const cached = getCachedAiReport(fingerprint)
      if (cached) { setAiContent(cached); setAiPhase('done'); return }
    }
    setAiLoadGen((g) => g + 1)
    setAiPhase('loading')
    setAiError('')
    setAiContent('')
    try {
      const prompt = buildHeBanPrompt(input.personA, results.resultA, input.personB, results.resultB, input.relation, readMode)
      const text = await fetchHeBanAIReading(prompt)
      setAiContent(text)
      setAiPhase('done')
setActiveTab('greeting')
                setTimeout(() => {
                  tabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 50)
                setCachedAiReport(fingerprint, text)
      try {
        await onAIReportComplete?.(text)
      } catch { /* 静默失败 */ }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : '解读失败，请重试')
      setAiPhase('error')
    }
  }

  const nameA = input.personA.name
  const nameB = input.personB.name
  const relationLabel = input.relation

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-6">
      <div className="space-y-5">

        {/* ── 上半部分：双方测算结果（Tab 切换） ── */}
        <div className="w-full">
          {/* Tab 切换栏 */}
          <div className="mb-4 flex gap-2">
            {[
              { key: 'A' as const, label: `① ${nameA}`, sub: '甲方' },
              { key: 'B' as const, label: `② ${nameB}`, sub: '乙方' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePersonTab(tab.key)}
                className={[
                  'flex-1 rounded-xl border px-4 py-3 text-center transition',
                  activePersonTab === tab.key
                    ? 'border-amber-400/60 bg-amber-400/15 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20',
                ].join(' ')}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{tab.sub}测算结果</div>
              </button>
            ))}
          </div>

          {/* 对应人的测算内容 */}
          {activePersonTab === 'A' ? (
            <Step2ChartsSection input={input.personA} results={results.resultA} />
          ) : (
            <Step2ChartsSection input={input.personB} results={results.resultB} />
          )}
        </div>

        {/* AI 合盘解读 */}
        <div className="w-full">
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-6">
            <div className="space-y-5">
              {/* 封面 */}
              <div className="rounded-2xl border border-amber-400/25 bg-white/[0.04] p-6 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs text-slate-200/80">四柱八字 · 五行合盘解读报告</div>
                    <div className="mt-2 text-xl font-semibold tracking-wide text-amber-100 sm:text-2xl">
                      {nameA} × {nameB}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100/90">
                      {relationLabel}
                    </div>
                  </div>
                  <div className="text-left text-xs text-slate-200/60 sm:text-right">
                    <div>生成时间：{new Date().toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* idle → 积分消耗按钮 */}
              {aiPhase === 'idle' ? (
                <div className="flex flex-col items-center justify-center gap-5 py-10">
                  <PointsBadge onClick={() => setShowPointsModal(true)} />

                  {/* 主按钮 */}
                  <button
                    type="button"
                    onClick={() => {
                      const cost = readMode === 'quick' ? POINTS_COST.HEBAN_READING_QUICK : POINTS_COST.HEBAN_READING_DEEP
                      if (balance >= cost) {
                        const label = readMode === 'quick' ? '快速解读' : '深度解读'
                        const ok = doConsume(cost, 'consume_heban', `合盘${label} - ${nameA}×${nameB}`)
                        if (ok) void startAiReading()
                      } else {
                        setShowPointsModal(true)
                      }
                    }}
                    className="w-64 rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3.5 text-sm font-semibold text-stone-900 shadow-[0_0_24px_rgba(251,191,36,0.35)] transition-all hover:brightness-110 active:scale-[0.97]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span>
                        开启 AI {readMode === 'quick' ? '快速' : '深度'}解读（{readMode === 'quick' ? POINTS_COST.HEBAN_READING_QUICK : POINTS_COST.HEBAN_READING_DEEP}积分）
                      </span>
                    </span>
                  </button>

                  {/* 快速 / 深度 切换 */}
                  <div className="flex w-48 items-center rounded-full border border-white/10 bg-white/[0.05] p-1">
                    <button
                      type="button"
                      onClick={() => setReadMode('quick')}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all ${
                        readMode === 'quick'
                          ? 'bg-amber-400/25 text-amber-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      快速
                    </button>
                    <button
                      type="button"
                      onClick={() => setReadMode('deep')}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all ${
                        readMode === 'deep'
                          ? 'bg-amber-400/25 text-amber-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
                      深度
                    </button>
                  </div>
                </div>
              ) : null}

              {/* 积分中心弹窗 */}
              <PointsModal
                open={showPointsModal}
                onClose={() => setShowPointsModal(false)}
                defaultTab={balance < POINTS_COST.HEBAN_READING_QUICK ? 'buy' : 'checkin'}
              />

              {/* loading */}
              {aiPhase === 'loading' ? <AiLoading key={aiLoadGen} estimatedSeconds={50} /> : null}

              {/* error */}
              {aiPhase === 'error' ? (
                <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
                  {aiError}
                  <button type="button" onClick={() => void startAiReading()} className="ml-3 underline hover:text-rose-100">重试</button>
                </div>
              ) : null}

              {/* done: 快速模式 → 整篇渲染 */}
              {aiPhase === 'done' && readMode === 'quick' && aiContent ? (() => {
                const { headerNote, greeting, rest } = parseAiOpeningBlocks(normalizeAiReportMarkdown(aiContent))
                const fullText = [
                  headerNote ? `*${headerNote}*` : '',
                  greeting,
                  rest,
                ].filter(Boolean).join('\n\n')
                return (
                  <div ref={tabTopRef} className="rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)] sm:p-6" style={READING_PANEL_SURFACE_STYLE}>
                    <TabContent markdown={fullText} />
                  </div>
                )
              })() : null}

              {/* done: 深度模式 → Tab 分章节展示 */}
              {aiPhase === 'done' && readMode === 'deep' && topics ? (
                <div ref={tabTopRef}>
                  {/* Tab 栏 */}
                  <div className="mb-1 flex overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-w-max gap-1.5 pb-2">
                      {HEBAN_TABS.map((tab) => {
                        const isActive = activeTab === tab.key
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => switchTab(tab.key)}
                            className={[
                              'flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all',
                              isActive
                                ? 'border-amber-400/70 bg-amber-400/20 text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]'
                                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200',
                            ].join(' ')}
                          >
                            <span className="text-[13px] leading-none">{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tab 内容 */}
                  <div
                    className="rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)] sm:p-6"
                    style={READING_PANEL_SURFACE_STYLE}
                  >
                    {/* 五行能量对比：只在「能量契合」Tab 顶部展示 */}
                    {activeTab === 'topic1' && (
                      <div className="mb-5">
                        <WuxingCompare
                          elementsA={results.resultA.bazi.elements}
                          elementsB={results.resultB.bazi.elements}
                          nameA={nameA}
                          nameB={nameB}
                        />
                      </div>
                    )}
                    <TabContent markdown={topics[activeTab]} />
                  </div>

                  {/* 底部翻页导航 */}
                  {(() => {
                    const currentIndex = HEBAN_TABS.findIndex((t) => t.key === activeTab)
                    const prevTab = HEBAN_TABS[currentIndex - 1]
                    const nextTab = HEBAN_TABS[currentIndex + 1]
                    if (!prevTab && !nextTab) return null
                    return (
                      <div className="mt-4 flex items-center justify-between gap-3">
                        {prevTab ? (
                          <button
                            type="button"
                            onClick={() => switchTab(prevTab.key)}
                            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-white/25 hover:text-slate-100"
                          >
                            <span>←</span>
                            <span className="text-xs opacity-70">{prevTab.icon} {prevTab.label}</span>
                          </button>
                        ) : <span />}
                        {nextTab ? (
                          <button
                            type="button"
                            onClick={() => switchTab(nextTab.key)}
                            className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-400/20"
                          >
                            <span className="text-xs opacity-70">{nextTab.icon} {nextTab.label}</span>
                            <span>→</span>
                          </button>
                        ) : <span />}
                      </div>
                    )
                  })()}
                </div>
              ) : null}

              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-center text-xs text-slate-500">
                  本报告仅用于娱乐与自我探索，请理性对待测算结果。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
