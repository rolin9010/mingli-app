import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  aiMarkdownComponents,
  normalizeAiReportMarkdown,
  parseAiOpeningBlocks,
} from '../lib/aiReportMarkdown'
import { fetchAIReading, buildReadingPrompt } from '../lib/ai'
import {
  clearCachedAiReport,
  computeAiReportFingerprint,
  getCachedAiReport,
  setCachedAiReport,
} from '../lib/aiReportCache'
import { usePoints } from '../lib/PointsContext'
import { POINTS_COST } from '../lib/points'
import PointsModal, { PointsBadge } from '../components/PointsModal'
import ConsultModal from '../components/ConsultModal'
import type { ReportResults, UserInput } from '../lib/types'
import { Step2ChartsSection } from './Step2Results'
import DailyTip from '../components/DailyTip'

// ─── Tab 主题定义 ──────────────────────────────────────────────────────────────

const TOPIC_TABS = [
  { key: 'greeting', label: '开篇', icon: '✦' },
  { key: 'topic1',   label: '能量画像', icon: '🌊' },
  { key: 'topic2',   label: '情绪特点', icon: '💫' },
  { key: 'topic3',   label: '人际关系', icon: '🤝' },
  { key: 'topic4',   label: '事业方向', icon: '🧭' },
  { key: 'topic5',   label: '子女相关', icon: '🌱' },
  { key: 'topic6',   label: '身体养护', icon: '🌿' },
  { key: 'topic7',   label: '行动指南', icon: '🌙' },
] as const

type TabKey = (typeof TOPIC_TABS)[number]['key']

/** 将 AI markdown 拆分为开篇 + 七主题 */
function parseTopics(markdown: string): Record<TabKey, string> {
  const normalized = normalizeAiReportMarkdown(markdown)
  const { headerNote, greeting, rest } = parseAiOpeningBlocks(normalized)

  // 开篇 tab：headerNote 小字 + 问候段
  const greetingParts: string[] = []
  if (headerNote) greetingParts.push(`*${headerNote}*`)
  if (greeting) greetingParts.push(greeting)
  const greetingContent = greetingParts.join('\n\n')

  // 按 ### 主题N: 拆分七个主题
  const sections: Record<string, string> = {}
  // 匹配 ### 主题1/一 … ### 主题7/七
  const chineseNums: Record<string, string> = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7' }

  // 按 ### 主题[数字/汉字] 分割
  const topicRegex = /###\s*主题[一二三四五六七1-7][：:：]?[^\n]*/g
  const matches: { index: number; title: string; num: string }[] = []

  let m: RegExpExecArray | null
  while ((m = topicRegex.exec(rest)) !== null) {
    const titleText = m[0]
    const numMatch = titleText.match(/主题([一二三四五六七1-7])/)
    if (!numMatch) continue
    const rawNum = numMatch[1]!
    const num = chineseNums[rawNum] ?? rawNum
    matches.push({ index: m.index, title: titleText, num })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index
    const end = i + 1 < matches.length ? matches[i + 1]!.index : rest.length
    const content = rest.slice(start, end).trim()
    sections[matches[i]!.num] = content
  }

  return {
    greeting: greetingContent || '（AI 还未生成开篇内容）',
    topic1: sections['1'] ?? '',
    topic2: sections['2'] ?? '',
    topic3: sections['3'] ?? '',
    topic4: sections['4'] ?? '',
    topic5: sections['5'] ?? '',
    topic6: sections['6'] ?? '',
    topic7: sections['7'] ?? '',
  }
}

// ─── 加载动画 ──────────────────────────────────────────────────────────────────

function AiMasterLoading({ estimatedSeconds }: { estimatedSeconds: number }) {
  const [remain, setRemain] = useState(estimatedSeconds)
  useEffect(() => {
    setRemain(estimatedSeconds)
    const id = window.setInterval(() => {
      setRemain((r) => (r <= 0 ? 0 : r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [estimatedSeconds])
  return (
    <div className="flex w-full flex-col items-start gap-4 py-10 text-left">
      <div className="relative h-20 w-20 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-amber-300/20" />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-400"
          style={{ animationDuration: '1.2s' }}
        />
        <div className="absolute inset-3 rounded-full border border-amber-300/10" />
        <div
          className="absolute inset-3 animate-spin rounded-full border border-transparent border-t-amber-300/40"
          style={{ animationDuration: '2s', animationDirection: 'reverse' }}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xl font-semibold tracking-wide text-amber-100 sm:text-2xl">AI 大师解读中</p>
        <p className="text-sm text-slate-300/90">
          {remain > 0 ? (
            <>倒计时 {remain} 秒</>
          ) : (
            <span className="text-amber-200/80">预计时间已到，仍在深度生成中，请稍候…</span>
          )}
        </p>
        <p className="text-xs leading-relaxed text-slate-400/90">正在结合四柱五行进行深度分析...</p>
      </div>
    </div>
  )
}

// ─── 小组件 ───────────────────────────────────────────────────────────────────

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[12px] text-amber-100/90">
      {children}
    </span>
  )
}

// ─── Tab 内容渲染 ─────────────────────────────────────────────────────────────

function TabContent({ markdown }: { markdown: string }) {
  if (!markdown || markdown.trim() === '') {
    return (
      <p className="py-6 text-center text-sm text-slate-400/80">
        该主题内容暂未解析到，请尝试重新生成报告。
      </p>
    )
  }
  return (
    <div
      className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed"
      style={{ fontFamily: AI_READING_SERIF }}
    >
      <ReactMarkdown components={aiMarkdownComponents}>{markdown}</ReactMarkdown>
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function Step3Report({
  input,
  results,
  onAIReportComplete,
}: {
  input: UserInput
  results: ReportResults
  onAIReportComplete?: (aiReport: string) => void | Promise<void>
}) {
  const baseFingerprint = useMemo(() => computeAiReportFingerprint(input), [input])
  const [readMode, setReadMode] = useState<'quick' | 'deep'>('quick')
  // 缓存 key 区分快速/深度，避免共用同一份缓存
  const reportFingerprint = useMemo(() => `${baseFingerprint}_${readMode}`, [baseFingerprint, readMode])

  const { balance, doConsume } = usePoints()
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [aiContent, setAiContent] = useState(() => getCachedAiReport(`${computeAiReportFingerprint(input)}_quick`) ?? '')
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    getCachedAiReport(`${computeAiReportFingerprint(input)}_quick`) ? 'done' : 'idle',
  )
  const [aiError, setAiError] = useState('')
  const [aiLoadGen, setAiLoadGen] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('greeting')
  const [consultOpen, setConsultOpen] = useState(false)
  const tabTopRef = useRef<HTMLDivElement>(null)

  const switchTab = (key: TabKey) => {
    setActiveTab(key)
    setTimeout(() => {
      tabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  /** 指纹或模式切换时，检查对应缓存 */
  useEffect(() => {
    const cached = getCachedAiReport(reportFingerprint)
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
  }, [reportFingerprint])

  useEffect(() => {
    const id = 'mingli-font-noto-serif-sc'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;600;700&display=swap'
    document.head.appendChild(link)
  }, [])

  const isLoading = aiPhase === 'loading'

  const aiLoadingEstimateSec = useMemo(() => {
    return 45
  }, [])

  /** 按主题拆分 */
  const topics = useMemo(() => {
    if (!aiContent) return null
    return parseTopics(aiContent)
  }, [aiContent])

  const startAiReading = async (options?: { force?: boolean }) => {
    const force = options?.force === true
    if (!force) {
      const cached = getCachedAiReport(reportFingerprint)
      if (cached) {
        setAiContent(cached)
        setAiPhase('done')
        setAiError('')
        return
      }
    } else {
      clearCachedAiReport(reportFingerprint)
    }
    setAiLoadGen((g) => g + 1)
    setAiPhase('loading')
    setAiError('')
    setAiContent('')
    try {
      const prompt = buildReadingPrompt(input, results, readMode)
const text = await fetchAIReading(prompt)
                setAiContent(text)
                setAiPhase('done')
                setActiveTab('greeting')
                setTimeout(() => {
                  tabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 50)
                setCachedAiReport(reportFingerprint, text)
      try {
        await onAIReportComplete?.(text)
      } catch { /* 静默失败 */ }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : '解读失败，请重试')
      setAiPhase('error')
    }
  }

  const reportCover = (
    <div className="rounded-2xl border border-amber-400/25 bg-white/[0.04] p-6 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs text-slate-200/80">四柱八字·五行能量解读报告</div>
          <div className="mt-2 text-2xl font-semibold tracking-wide text-amber-100 sm:text-3xl">{input.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>性别：{input.gender}</Pill>
          </div>
        </div>
        <div className="text-left text-sm text-slate-200/80 sm:text-right">
          <div>
            出生：{input.birth.year}-{String(input.birth.month).padStart(2, '0')}-{String(input.birth.day).padStart(2, '0')}{' '}
            {String(input.birth.hour).padStart(2, '0')}:{String(input.birth.minute ?? 0).padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs text-slate-200/60">生成时间：{new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <div id="report" className="space-y-5">
        <div className="space-y-5">
          <Step2ChartsSection input={input} results={results} />
        </div>

        {/* 五行贴士·今日 */}
        <DailyTip input={input} results={results} />

        {/* AI 解读区 */}
        <div className="w-full">
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-6">
            <div className="space-y-5">
              {reportCover}

              {/* idle: 未生成 → 积分消耗按钮 */}
              {aiPhase === 'idle' ? (
                <div className="flex flex-col items-center justify-center gap-5 py-10">
                  <PointsBadge onClick={() => setShowPointsModal(true)} />

                  {/* 主按钮 */}
                  <button
                    type="button"
                    onClick={() => {
                      const cost = readMode === 'quick' ? POINTS_COST.AI_READING_QUICK : POINTS_COST.AI_READING_DEEP
                      if (balance >= cost) {
                        const label = readMode === 'quick' ? '快速解读' : '深度解读'
                        void doConsume(cost, 'consume_ai', `AI${label} - ${input.name}`).then((ok) => {
                          if (ok) void startAiReading()
                        })
                      } else {
                        setShowPointsModal(true)
                      }
                    }}
                    className="w-64 rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3.5 text-sm font-semibold text-stone-900 shadow-[0_0_24px_rgba(251,191,36,0.35)] transition-all hover:brightness-110 active:scale-[0.97]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span>
                        开启 AI {readMode === 'quick' ? '快速' : '深度'}解读（{readMode === 'quick' ? POINTS_COST.AI_READING_QUICK : POINTS_COST.AI_READING_DEEP}积分）
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
                defaultTab={balance < POINTS_COST.AI_READING_QUICK ? 'buy' : 'checkin'}
              />

              {/* loading */}
              {isLoading ? (
                <AiMasterLoading key={aiLoadGen} estimatedSeconds={aiLoadingEstimateSec} />
              ) : null}

              {/* error */}
              {aiPhase === 'error' ? (
                <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
                  {aiError}
                  <button
                    type="button"
                    onClick={() => void startAiReading()}
                    className="ml-3 underline hover:text-rose-100"
                  >
                    重试
                  </button>
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
                      {TOPIC_TABS.map((tab) => {
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
                    <TabContent markdown={topics[activeTab]} />
                  </div>

                  {/* 底部翻页导航 */}
                  {(() => {
                    const currentIndex = TOPIC_TABS.findIndex((t) => t.key === activeTab)
                    const prevTab = TOPIC_TABS[currentIndex - 1]
                    const nextTab = TOPIC_TABS[currentIndex + 1]
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

              {/* 底部：免责 + 咨询入口 */}
              <div className="mt-6 border-t border-white/10 pt-6 space-y-4">
                <p className="text-center text-xs text-slate-500">
                  本测算提供基础分析，若遇人生重大抉择，建议咨询后台客服，获取个性化深度指导。
                </p>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setConsultOpen(true)}
                    className="group flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/8 px-5 py-2.5 text-sm text-amber-300 transition-all hover:border-amber-400/60 hover:bg-amber-400/15 hover:text-amber-200 active:scale-95"
                  >
                    <span className="text-base">🔮</span>
                    立即咨询客服，获取深度指导
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 咨询客服对话框 */}
      <ConsultModal
        open={consultOpen}
        onClose={() => setConsultOpen(false)}
        contextInfo={`单人报告 - ${input.name}`}
      />
    </div>
  )
}
