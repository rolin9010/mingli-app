import { useEffect, useMemo, useState } from 'react'
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  AiReportMarkdown,
  normalizeAiReportMarkdown,
} from '../lib/aiReportMarkdown'
import { getReading, getReadings, isHeBanInputData, type ReadingDetail, type ReadingListItem } from '../lib/history'
import { Step2ChartsSection } from './Step2Results'
import { computeAll } from '../lib/mingli/computeReport'
import type { HeBanResults, HeBanUserInput, ReportResults, UserInput } from '../lib/types'

export interface HistoryPageProps {
  onBack: () => void
}

export default function HistoryPage({ onBack }: HistoryPageProps) {
  const [list, setList] = useState<ReadingListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReadingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // 单人排盘
  const [computedResults, setComputedResults] = useState<ReportResults | null>(null)
  const [computedLoading, setComputedLoading] = useState(false)
  const [computedError, setComputedError] = useState('')

  // 合盘排盘
  const [heBanResults, setHeBanResults] = useState<HeBanResults | null>(null)
  const [heBanLoading, setHeBanLoading] = useState(false)
  const [heBanError, setHeBanError] = useState('')

  // 判断当前详情是否为合盘
  const isHeBan = useMemo(() => isHeBanInputData(detail?.input_data ?? null), [detail?.input_data])

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getReadings()
        if (!cancelled) setList(rows)
      } catch (e: unknown) {
        if (!cancelled) setListError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError('')
    void (async () => {
      try {
        const row = await getReading(selectedId)
        if (!cancelled) setDetail(row)
      } catch (e: unknown) {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // 单人排盘计算
  useEffect(() => {
    if (!detail?.input_data || isHeBan) {
      setComputedResults(null)
      setComputedLoading(false)
      setComputedError('')
      return
    }

    let cancelled = false
    setComputedLoading(true)
    setComputedError('')
    setComputedResults(null)

    void (async () => {
      try {
        const res = computeAll(detail.input_data as UserInput)
        if (cancelled) return
        setComputedResults(res)
      } catch (e: unknown) {
        if (cancelled) return
        setComputedError(e instanceof Error ? e.message : '排盘失败')
      } finally {
        if (cancelled) return
        setComputedLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detail?.input_data, isHeBan])

  // 合盘排盘计算
  useEffect(() => {
    if (!detail?.input_data || !isHeBan) {
      setHeBanResults(null)
      setHeBanLoading(false)
      setHeBanError('')
      return
    }

    let cancelled = false
    setHeBanLoading(true)
    setHeBanError('')
    setHeBanResults(null)

    void (async () => {
      try {
        const heBanInput = detail.input_data as HeBanUserInput
        const resultA = computeAll(heBanInput.personA)
        const resultB = computeAll(heBanInput.personB)
        if (cancelled) return
        setHeBanResults({ resultA, resultB })
      } catch (e: unknown) {
        if (cancelled) return
        setHeBanError(e instanceof Error ? e.message : '排盘失败')
      } finally {
        if (cancelled) return
        setHeBanLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detail?.input_data, isHeBan])

  const displayMd = useMemo(() => {
    const raw = detail?.ai_report ?? ''
    return normalizeAiReportMarkdown(raw)
  }, [detail?.ai_report])

  // ── 详情页 ──
  if (selectedId) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <button
          type="button"
          onClick={() => {
            setSelectedId(null)
            setDetail(null)
            setDetailError('')
          }}
          className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:border-white/20"
        >
          ← 返回列表
        </button>
        {detail && !detailLoading ? (
          <div className="mb-4 text-sm text-slate-400">
            <span className="text-amber-100/90">{detail.name ?? '—'}</span>
            <span className="mx-2">·</span>
            <span>{detail.birth_date ?? '—'}</span>
            <span className="mx-2">·</span>
            <span>{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</span>
            {isHeBan && (
              <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">合盘</span>
            )}
          </div>
        ) : null}

        {/* 单人排盘图表 */}
        {!isHeBan && (
          <>
            {computedLoading ? <p className="text-sm text-slate-400">加载排盘结果…</p> : null}
            {computedError ? <p className="text-sm text-rose-400">{computedError}</p> : null}
            {!computedLoading && !computedError && detail?.input_data && computedResults ? (
              <div className="space-y-5">
                <Step2ChartsSection input={detail.input_data as UserInput} results={computedResults} />
              </div>
            ) : null}
          </>
        )}

        {/* 合盘排盘图表 */}
        {isHeBan && detail?.input_data && (
          <>
            {heBanLoading ? <p className="text-sm text-slate-400">加载合盘排盘结果…</p> : null}
            {heBanError ? <p className="text-sm text-rose-400">{heBanError}</p> : null}
            {!heBanLoading && !heBanError && heBanResults ? (
              <div className="space-y-8">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-amber-100">
                    甲方 · {(detail.input_data as HeBanUserInput).personA.name}
                  </h3>
                  <Step2ChartsSection
                    input={(detail.input_data as HeBanUserInput).personA}
                    results={heBanResults.resultA}
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-amber-100">
                    乙方 · {(detail.input_data as HeBanUserInput).personB.name}
                  </h3>
                  <Step2ChartsSection
                    input={(detail.input_data as HeBanUserInput).personB}
                    results={heBanResults.resultB}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* AI 解读报告 */}
        {detailLoading ? (
          <p className="text-sm text-slate-400">加载中…</p>
        ) : detailError ? (
          <p className="text-sm text-rose-400">{detailError}</p>
        ) : detail ? (
          <div className="mx-auto mt-6 w-full max-w-3xl">
            <div
              className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)] sm:p-7"
              style={{
                fontFamily: AI_READING_SERIF,
                ...READING_PANEL_SURFACE_STYLE,
              }}
            >
              <AiReportMarkdown markdown={displayMd || detail.ai_report || ''} />
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // ── 列表页 ──
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:border-white/20"
      >
        ← 返回
      </button>
      <h2 className="mb-6 text-lg font-semibold tracking-wide text-amber-100">历史记录</h2>

      {loading ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : listError ? (
        <p className="text-sm text-rose-400">{listError}</p>
      ) : !list || list.length === 0 ? (
        <p className="text-sm text-slate-400">暂无历史记录，去测算一次吧</p>
      ) : (
        <ul className="space-y-3">
          {list.map((row) => {
            const isHeBanItem = row.name?.includes('合盘')
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="w-full rounded-xl border border-amber-400/20 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-amber-400/40 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-100/95">{row.name ?? '未命名'}</span>
                    {isHeBanItem && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">合盘</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                    <span>{isHeBanItem ? '排盘' : '出生'}：{row.birth_date ?? '—'}</span>
                    <span>时间：{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
