import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  AiReportMarkdown,
  normalizeAiReportMarkdown,
} from '../lib/aiReportMarkdown'
import { fetchAIReading, buildReadingPrompt } from '../lib/ai'
import {
  clearCachedAiReport,
  computeAiReportFingerprint,
  getCachedAiReport,
  setCachedAiReport,
} from '../lib/aiReportCache'
import type { ReportResults, UserInput } from '../lib/types'
import { Step2ChartsSection } from './Step2Results'

/** 按勾选体系数量估算等待时长，倒计时结束后仍显示「仍在生成」 */
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
        <p className="text-xs leading-relaxed text-slate-400/90">正在结合各种排盘系统进行综合交叉分析...</p>
      </div>
    </div>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[12px] text-amber-100/90">
      {children}
    </span>
  )
}

export default function Step3Report({
  input,
  results,
  onAIReportComplete,
}: {
  input: UserInput
  results: ReportResults
  /** AI 解读成功后的回调（例如保存历史）；错误由调用方自行吞掉 */
  onAIReportComplete?: (aiReport: string) => void | Promise<void>
}) {
  /** 同一套测算数据对应同一 key，用于本地缓存 AI 正文（刷新不丢、不重复扣 token） */
  const reportFingerprint = useMemo(() => computeAiReportFingerprint(input), [input])

  const [aiContent, setAiContent] = useState(() => getCachedAiReport(computeAiReportFingerprint(input)) ?? '')
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'done' | 'error'>(() =>
    getCachedAiReport(computeAiReportFingerprint(input)) ? 'done' : 'idle',
  )
  const [aiError, setAiError] = useState('')
  const [aiLoadGen, setAiLoadGen] = useState(0)

  /** 换人或重新排盘后指纹变化：有缓存则直接展示，否则回到「未生成」 */
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
  }, [reportFingerprint])

  useEffect(() => {
    const id = 'mingli-font-noto-serif-sc'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;600;700&display=swap'
    document.head.appendChild(link)
  }, [])

  const isLoading = aiPhase === 'loading'

  const aiLoadingEstimateSec = useMemo(() => {
    const n = input.selectedChartSystems?.length ?? 7
    return Math.min(100, 22 + n * 9)
  }, [input.selectedChartSystems])

  const displayMarkdown = useMemo(() => {
    if (aiPhase !== 'done' || !aiContent) return ''
    return normalizeAiReportMarkdown(aiContent)
  }, [aiPhase, aiContent])

  /**
   * @param force 为 true 时表示「重新生成」：不走本地缓存，必须请求 API
   */
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
      const prompt = buildReadingPrompt(input, results)
      const text = await fetchAIReading(prompt)
      setAiContent(text)
      setAiPhase('done')
      setCachedAiReport(reportFingerprint, text)
      try {
        await onAIReportComplete?.(text)
      } catch {
        /* 静默失败 */
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : '解读失败，请重试')
      setAiPhase('error')
    }
  }

  const reportCover = (
    <div className="rounded-2xl border border-amber-400/25 bg-white/[0.04] p-6 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs text-slate-200/80">命理综合解读报告</div>
          <div className="mt-2 text-2xl font-semibold tracking-wide text-amber-100 sm:text-3xl">{input.name}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>性别：{input.gender}</Pill>
            {input.selectedChartSystems?.includes('血型') ? <Pill>血型：{input.bloodType}</Pill> : null}
            {input.selectedChartSystems?.includes('MBTI') && input.mbti ? <Pill>MBTI：{input.mbti}</Pill> : null}
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
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-8">
      <div id="report" className="space-y-5">
        <div className="space-y-5">
          <Step2ChartsSection input={input} results={results} />
        </div>

        {/* 与 Step2ChartsSection 同宽：整块大卡片 max-w-3xl 居中 */}
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.06] p-6">
            <div className="space-y-5">
              {reportCover}

              {aiPhase === 'idle' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <button
                    type="button"
                    onClick={() => void startAiReading()}
                    className="rounded-xl border border-amber-400/60 bg-amber-400/20 px-8 py-3 text-sm font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)] hover:bg-amber-400/30"
                  >
                    查看 AI 解读报告
                  </button>
                </div>
              ) : null}
              {isLoading ? (
                <AiMasterLoading key={aiLoadGen} estimatedSeconds={aiLoadingEstimateSec} />
              ) : null}
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
              {aiPhase === 'done' && aiContent ? (
                <>
                  <div
                    className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)] sm:p-7"
                    style={{
                      fontFamily: AI_READING_SERIF,
                      ...READING_PANEL_SURFACE_STYLE,
                    }}
                  >
                    <AiReportMarkdown markdown={displayMarkdown || aiContent} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAiPhase('idle')
                        setAiContent('')
                        setAiError('')
                      }}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:border-white/25"
                    >
                      收起解读
                    </button>
                    <button
                      type="button"
                      onClick={() => void startAiReading({ force: true })}
                      className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-400/20"
                    >
                      重新生成
                    </button>
                  </div>
                </>
              ) : null}

              <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-6 text-slate-100/70">
                本报告仅用于娱乐与自我探索。请理性对待测算结果，把行动落实到现实生活中。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-white/20"
        >
          回到顶部
        </button>
      </div>
    </div>
  )
}
