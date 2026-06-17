import { Component, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/** 捕获子树渲染异常，防止整页白屏 */
class DetailErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">
          <p className="text-sm font-medium text-rose-300">渲染出错</p>
          <p className="mt-1 text-xs text-rose-400/80 break-all">{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  AiReportMarkdown,
  normalizeAiReportMarkdown,
} from '../lib/aiReportMarkdown'
import {
  deleteReading,
  generateBindingCode,
  getReading,
  getReadings,
  isHeBanInputData,
  setPrimaryReading,
  updateReadingName,
  type BaziSummary,
  type ReadingDetail,
  type ReadingListItem,
} from '../lib/history'
import { Step2ChartsSection } from './Step2Results'
import { computeAll } from '../lib/mingli/computeReport'
import { calcBazi } from '../lib/mingli/bazi'
import type { HeBanResults, HeBanUserInput, ReportResults, UserInput } from '../lib/types'

/** 根据 input_data 计算四柱，返回「年干支 月干支 日干支 时干支」数组 */
function getPillarsFromInput(row: ReadingListItem): string[] | null {
  const data = row.input_data
  if (!data) return null
  try {
    if (isHeBanInputData(data)) {
      // 合盘：显示甲方四柱
      const p = calcBazi(data.personA.birth, data.personA.calendarType ?? '公历')
      return [p.pillars.year, p.pillars.month, p.pillars.day, p.pillars.hour]
    } else {
      const p = calcBazi((data as UserInput).birth, (data as UserInput).calendarType ?? '公历')
      return [p.pillars.year, p.pillars.month, p.pillars.day, p.pillars.hour]
    }
  } catch {
    return null
  }
}

/** 从 input_data 里提取用于展示的出生日期字符串（阳历/阴历均兼容） */
function getBirthLabel(row: ReadingListItem): string {
  const data = row.input_data
  if (!data) return row.birth_date ?? '—'
  try {
    const input = isHeBanInputData(data) ? data.personA : (data as UserInput)
    const { year, month, day, hour, minute = 0 } = input.birth
    const calType = input.calendarType === '农历' ? '农' : '阳'
    return `${calType}历 ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  } catch {
    return row.birth_date ?? '—'
  }
}

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

  // 设为主档案相关状态
  const [primaryId, setPrimaryId] = useState<string | null>(() => {
    // 从列表里找出已标记的（初始为 null，等列表加载完再同步）
    return null
  })
  const [primaryLoading, setPrimaryLoading] = useState(false)

  // 绑定码相关状态
  const [bindingCode, setBindingCode] = useState<string | null>(null)
  const [bindingCodeExpiry, setBindingCodeExpiry] = useState<Date | null>(null)
  const [bindingCodeLoading, setBindingCodeLoading] = useState(false)
  const [showBindingPanel, setShowBindingPanel] = useState(false)

  // 删除相关状态
  const [deletingId, setDeletingId] = useState<string | null>(null)   // 正在确认删除的 id
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 修改名称相关状态
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')

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
        if (!cancelled) {
          setList(rows)
          // 找出已标记的主档案
          const primary = (rows as (ReadingListItem & { is_primary?: boolean })[]).find(r => r.is_primary)
          if (primary) setPrimaryId(primary.id)
        }
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
        if (!cancelled) {
          setDetail(row)
          setNameInput(row.name ?? '')
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e)
        console.error('[getReading] 详情加载失败:', e)
        if (!cancelled) setDetailError(msg || '加载失败，请刷新重试')
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
    return () => { cancelled = true }
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
    return () => { cancelled = true }
  }, [detail?.input_data, isHeBan])

  const displayMd = useMemo(() => {
    const raw = detail?.ai_report ?? ''
    return normalizeAiReportMarkdown(raw)
  }, [detail?.ai_report])

  // 仅保留个人档案（过滤合盘）—— 必须在 if (selectedId) return 之前调用，确保 Hook 顺序稳定
  const personalList = useMemo(
    () => (list ?? []).filter((row) => !isHeBanInputData(row.input_data ?? null)),
    [list],
  )

  // ── 设为主档案 ──
  const handleSetPrimary = async (id: string) => {
    setPrimaryLoading(true)
    try {
      // 找到这条记录的 input_data，计算 baziSummary
      const row = list?.find(r => r.id === id)
      let baziSummary: BaziSummary | undefined
      if (row?.input_data && !isHeBanInputData(row.input_data)) {
        try {
          const bazi = calcBazi((row.input_data as UserInput).birth, (row.input_data as UserInput).calendarType ?? '公历')
          const fullResult = computeAll(row.input_data as UserInput)
          baziSummary = {
            pillars: bazi.pillars,
            elements: fullResult.bazi.elements.map(e => ({ element: e.element, percent: e.percent })),
          }
        } catch {
          // 计算失败不影响主流程
        }
      }
      await setPrimaryReading(id, baziSummary)
      setPrimaryId(id)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '操作失败')
    } finally {
      setPrimaryLoading(false)
    }
  }

  // ── 生成绑定码 ──
  const handleGenerateCode = async () => {
    setBindingCodeLoading(true)
    try {
      const code = await generateBindingCode()
      setBindingCode(code)
      setBindingCodeExpiry(new Date(Date.now() + 10 * 60 * 1000))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBindingCodeLoading(false)
    }
  }

  // ── 删除处理 ──
  const handleDelete = async (id: string) => {
    setDeleteLoading(true)
    try {
      await deleteReading(id)
      setList((prev) => prev?.filter((r) => r.id !== id) ?? null)
      setDeletingId(null)
      // 若正在查看该详情，返回列表
      if (selectedId === id) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── 修改名称处理 ──
  const handleSaveName = async () => {
    if (!selectedId || !nameInput.trim()) return
    setNameLoading(true)
    setNameError('')
    try {
      await updateReadingName(selectedId, nameInput.trim())
      setDetail((prev) => prev ? { ...prev, name: nameInput.trim() } : prev)
      setList((prev) =>
        prev?.map((r) => r.id === selectedId ? { ...r, name: nameInput.trim() } : r) ?? null,
      )
      setEditingName(false)
    } catch (e: unknown) {
      setNameError(e instanceof Error ? e.message : '修改失败')
    } finally {
      setNameLoading(false)
    }
  }

  // ── 详情页 ──
  if (selectedId) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
        {/* 顶部操作栏 */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null)
              setDetail(null)
              setDetailError('')
              setEditingName(false)
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:border-white/20"
          >
            ← 返回列表
          </button>
          {detail && !detailLoading && (
            <button
              type="button"
              onClick={() => setDeletingId(selectedId)}
              className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-300 hover:border-rose-400/50 hover:bg-rose-400/15"
            >
              删除记录
            </button>
          )}
        </div>

        {/* 加载中 / 错误状态 */}
        {detailLoading && <p className="mb-4 text-sm text-slate-400">加载中…</p>}
        {detailError && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">
            <p className="text-sm font-medium text-rose-300">加载失败</p>
            <p className="mt-1 text-xs text-rose-400/80 break-all">{detailError}</p>
          </div>
        )}

        {/* 标题 / 名称编辑区 */}
        {detail && !detailLoading ? (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-white/[0.03] px-4 py-4">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName() }}
                  autoFocus
                  className="flex-1 rounded-xl border border-amber-400/40 bg-white/5 px-3 py-1.5 text-sm text-amber-100 outline-none focus:border-amber-400/70"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  disabled={nameLoading}
                  className="rounded-xl border border-amber-400/50 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/25 disabled:opacity-50"
                >
                  {nameLoading ? '保存…' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setNameInput(detail.name ?? ''); setNameError('') }}
                  className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-amber-100/95">{detail.name ?? '—'}</span>
                {isHeBan && (
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">合盘</span>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingName(true); setNameInput(detail.name ?? '') }}
                  className="ml-1 rounded-lg border border-white/10 px-2 py-0.5 text-[11px] text-slate-400 hover:border-white/20 hover:text-slate-200"
                >
                  ✎ 修改名称
                </button>
              </div>
            )}
            {nameError && <p className="mt-1 text-xs text-rose-400">{nameError}</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
              <span>{detail.birth_date ?? '—'}</span>
              <span>·</span>
              <span>{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</span>
            </div>
          </div>
        ) : null}

        {/* 单人排盘图表 */}
        {!isHeBan && (
          <>
            {computedLoading ? <p className="text-sm text-slate-400">加载排盘结果…</p> : null}
            {computedError ? <p className="text-sm text-rose-400">{computedError}</p> : null}
            {!computedLoading && !computedError && detail?.input_data && computedResults ? (
              <DetailErrorBoundary>
                <div className="space-y-5">
                  <Step2ChartsSection input={detail.input_data as UserInput} results={computedResults} />
                </div>
              </DetailErrorBoundary>
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
        {!detailLoading && !detailError && detail ? (
          <DetailErrorBoundary>
            <div className="mt-6 w-full">
              <div
                className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)] sm:p-7"
                style={{ fontFamily: AI_READING_SERIF, ...READING_PANEL_SURFACE_STYLE }}
              >
                <AiReportMarkdown markdown={displayMd || detail.ai_report || ''} />
              </div>
            </div>
          </DetailErrorBoundary>
        ) : null}

        {/* 删除确认弹窗 */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <p className="mb-2 text-base font-semibold text-slate-100">确认删除？</p>
              <p className="mb-6 text-sm text-slate-400">删除后无法恢复，AI 解读内容也将一并删除。</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-200 hover:border-white/20"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(deletingId)}
                  disabled={deleteLoading}
                  className="flex-1 rounded-xl border border-rose-400/40 bg-rose-400/15 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-400/25 disabled:opacity-50"
                >
                  {deleteLoading ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 列表页 ──

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:border-white/20"
      >
        ← 返回
      </button>
      <h2 className="mb-6 text-lg font-semibold tracking-wide text-amber-100">历史档案</h2>

      {/* 绑定小程序入口 */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowBindingPanel(v => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-left transition hover:border-amber-400/35 hover:bg-amber-400/8"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📱</span>
            <div>
              <div className="text-sm font-medium text-amber-100">绑定松眠小程序</div>
              <div className="text-xs text-slate-400 mt-0.5">生成绑定码，在小程序中输入即可同步你的八字</div>
            </div>
          </div>
          <span className="text-slate-500 text-xs">{showBindingPanel ? '▲' : '▼'}</span>
        </button>

        {showBindingPanel && (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
            {bindingCode && bindingCodeExpiry ? (
              <div className="text-center">
                <p className="mb-1 text-xs text-slate-400">在松眠小程序「绑定账号」页面输入以下验证码</p>
                <div className="my-3 font-mono text-4xl font-bold tracking-[0.3em] text-amber-300">
                  {bindingCode}
                </div>
                <p className="text-xs text-slate-500">
                  {new Date() < bindingCodeExpiry
                    ? `有效至 ${bindingCodeExpiry.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                    : '已过期，请重新生成'
                  }
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerateCode()}
                  disabled={bindingCodeLoading}
                  className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
                >
                  重新生成
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="mb-3 text-xs text-slate-400">点击生成一个 10 分钟有效的绑定码</p>
                <button
                  type="button"
                  onClick={() => void handleGenerateCode()}
                  disabled={bindingCodeLoading}
                  className="rounded-xl border border-amber-400/50 bg-amber-400/15 px-6 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/25 disabled:opacity-50"
                >
                  {bindingCodeLoading ? '生成中…' : '生成绑定码'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : listError ? (
        <p className="text-sm text-rose-400">{listError}</p>
      ) : personalList.length === 0 ? (
        <p className="text-sm text-slate-400">暂无个人档案，去测算一次吧</p>
      ) : (
        <ul className="space-y-3">
          {personalList.map((row) => {
            const isPrimary = row.id === primaryId
            const pillars = getPillarsFromInput(row)
            const birthLabel = getBirthLabel(row)
            const updatedAt = row.created_at
              ? new Date(row.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
              : '—'
            return (
              <li key={row.id} className="space-y-1.5">
                {/* 主按钮 — 点击进入详情 */}
                <div className={`flex items-stretch gap-2 rounded-xl border transition-colors ${
                  isPrimary
                    ? 'border-amber-400/50 bg-amber-400/8'
                    : 'border-amber-400/20 bg-white/[0.04] hover:border-amber-400/40 hover:bg-white/[0.06]'
                }`}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="flex-1 px-4 py-3 text-left"
                  >
                    {/* 第一行：姓名 + 标签 + 时间 */}
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="font-medium text-amber-100/95 leading-snug truncate">{row.name ?? '未命名'}</span>
                        {isPrimary && (
                          <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 leading-none">
                            ★ 我的八字
                          </span>
                        )}
                        {row.ai_report ? (
                          <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 leading-none">
                            已解读
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-500 leading-none">
                            未解读
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{updatedAt}</span>
                    </div>
                    {/* 第二行：出生日期 + 四柱 */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-slate-400 leading-relaxed">{birthLabel}</span>
                      {pillars ? (
                        <div className="shrink-0 flex gap-2">
                          {(['年', '月', '日', '时'] as const).map((label, i) => {
                            const gz = pillars[i] ?? ''
                            const stem = gz[0] ?? ''
                            const branch = gz[1] ?? ''
                            return (
                              <div key={label} className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-slate-500 leading-none">{label}</span>
                                <span className="text-xs font-medium text-amber-200/90 leading-tight">{stem}</span>
                                <span className="text-xs font-medium text-amber-200/70 leading-tight">{branch}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </button>

                  {/* 右侧操作列 */}
                  <div className="flex flex-col gap-1 py-2 pr-2">
                    {/* 设为我的八字 */}
                    <button
                      type="button"
                      title={isPrimary ? '已是我的八字' : '设为我的八字'}
                      disabled={primaryLoading || isPrimary}
                      onClick={() => void handleSetPrimary(row.id)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                        isPrimary
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-300 cursor-default'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-amber-400/40 hover:text-amber-200'
                      } disabled:opacity-60`}
                    >
                      {isPrimary ? '★' : '☆'}
                    </button>
                    {/* 删除 */}
                    <button
                      type="button"
                      onClick={() => setDeletingId(row.id)}
                      title="删除"
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-rose-400/70 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* 删除确认弹窗 */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <p className="mb-2 text-base font-semibold text-slate-100">确认删除？</p>
            <p className="mb-6 text-sm text-slate-400">删除后无法恢复，AI 解读内容也将一并删除。</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-200 hover:border-white/20"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deletingId)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl border border-rose-400/40 bg-rose-400/15 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-400/25 disabled:opacity-50"
              >
                {deleteLoading ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
