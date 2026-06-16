import { useEffect, useState } from 'react'
import {
  adminGetUserDetail,
  adminAdjustPoints,
  type AdminUserDetail,
  type AdminReading,
} from '../../lib/admin'
import type { UserInput, HeBanUserInput, ReportResults, HeBanResults } from '../../lib/types'
import { isHeBanInputData } from '../../lib/history'
import {
  AI_READING_SERIF,
  READING_PANEL_SURFACE_STYLE,
  AiReportMarkdown,
  normalizeAiReportMarkdown,
} from '../../lib/aiReportMarkdown'
import { computeAll } from '../../lib/mingli/computeReport'
import { Step2ChartsSection } from '../Step2Results'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// ─── 单条测算展开内容（懒计算排盘） ──────────────────────────────────────────

function ReadingExpandedContent({
  r,
  onViewFullReport,
}: {
  r: AdminReading
  onViewFullReport: (r: AdminReading) => void
}) {
  const inputData = r.input_data as UserInput | HeBanUserInput | null
  const isHeBan = isHeBanInputData(inputData ?? null)

  const [results, setResults] = useState<ReportResults | null>(null)
  const [heBanResults, setHeBanResults] = useState<HeBanResults | null>(null)
  const [computing, setComputing] = useState(false)
  const [computeErr, setComputeErr] = useState('')

  useEffect(() => {
    if (!inputData) return
    setComputing(true)
    setComputeErr('')
    try {
      if (isHeBan) {
        const hbi = inputData as HeBanUserInput
        setHeBanResults({ resultA: computeAll(hbi.personA), resultB: computeAll(hbi.personB) })
      } else {
        setResults(computeAll(inputData as UserInput))
      }
    } catch (e) {
      setComputeErr(e instanceof Error ? e.message : '排盘失败')
    } finally {
      setComputing(false)
    }
  }, []) // 只算一次

  return (
    <div className="border-t border-white/[0.06] px-4 py-4 space-y-4">
      {/* 排盘内容 */}
      {computing && <p className="text-xs text-slate-500">排盘计算中…</p>}
      {computeErr && <p className="text-xs text-rose-400">{computeErr}</p>}

      {/* 单人 */}
      {!isHeBan && !computing && !computeErr && inputData && results && (
        <Step2ChartsSection input={inputData as UserInput} results={results} />
      )}

      {/* 合盘 */}
      {isHeBan && !computing && !computeErr && inputData && heBanResults && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 text-[11px] font-medium text-amber-300/80">
              甲方 · {(inputData as HeBanUserInput).personA.name}
            </div>
            <Step2ChartsSection
              input={(inputData as HeBanUserInput).personA}
              results={heBanResults.resultA}
            />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-medium text-amber-300/80">
              乙方 · {(inputData as HeBanUserInput).personB.name}
              {' · 关系：'}{(inputData as HeBanUserInput).relation}
            </div>
            <Step2ChartsSection
              input={(inputData as HeBanUserInput).personB}
              results={heBanResults.resultB}
            />
          </div>
        </div>
      )}

      {/* AI 解读预览 */}
      {r.ai_report && (
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">AI 解读</span>
            <button
              type="button"
              onClick={() => onViewFullReport(r)}
              className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-300 hover:bg-amber-400/20 transition-colors"
            >
              查看全文 ↗
            </button>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-10">
            {r.ai_report.slice(0, 300)}{r.ai_report.length > 300 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 用户详情面板（可独立使用） ───────────────────────────────────────────────

export default function UserDetailPanel({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedReadingId, setExpandedReadingId] = useState<string | null>(null)
  // 全屏查看 AI 解读的记录
  const [fullscreenReading, setFullscreenReading] = useState<AdminReading | null>(null)

  // 积分调整
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustDesc, setAdjustDesc] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    adminGetUserDetail(userId).then((d) => { setDetail(d); setLoading(false) })
  }, [userId])

  const handleAdjust = async () => {
    const delta = parseInt(adjustDelta)
    if (isNaN(delta) || delta === 0) { setAdjustMsg({ type: 'err', text: '请输入有效数字（非零）' }); return }
    if (!adjustDesc.trim()) { setAdjustMsg({ type: 'err', text: '请填写原因' }); return }
    setAdjusting(true)
    const { success, error } = await adminAdjustPoints(userId, delta, adjustDesc.trim())
    setAdjusting(false)
    if (success) {
      setAdjustMsg({ type: 'ok', text: `操作成功，${delta > 0 ? '+' : ''}${delta} 积分` })
      setAdjustDelta('')
      setAdjustDesc('')
      const fresh = await adminGetUserDetail(userId)
      setDetail(fresh)
    } else {
      setAdjustMsg({ type: 'err', text: error ?? '操作失败' })
    }
    setTimeout(() => setAdjustMsg(null), 3000)
  }

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
  if (!detail) return <div className="py-20 text-center text-sm text-slate-500">用户不存在</div>

  return (
    <div className="space-y-5">
      {/* 返回按钮 */}
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        返回
      </button>

      {/* 基本信息 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">基本信息</h2>
        <div className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
          <div><div className="text-slate-500 mb-0.5">邮箱</div><div className="text-slate-200 font-mono">{detail.email}</div></div>
          <div><div className="text-slate-500 mb-0.5">用户 ID</div><div className="text-slate-400 font-mono truncate">{detail.id}</div></div>
          <div><div className="text-slate-500 mb-0.5">积分余额</div><div className="text-amber-300 font-bold text-lg">{detail.balance}</div></div>
          <div><div className="text-slate-500 mb-0.5">测算次数</div><div className="text-slate-200">{detail.readingCount} 次</div></div>
        </div>
      </div>

      {/* 积分管理 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">调整积分</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="mb-1 text-[11px] text-slate-500">数量（正数加、负数减）</div>
            <input
              type="number"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              placeholder="例：+10 或 -5"
              className="w-28 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-40">
            <div className="mb-1 text-[11px] text-slate-500">备注原因</div>
            <input
              type="text"
              value={adjustDesc}
              onChange={(e) => setAdjustDesc(e.target.value)}
              placeholder="例：邀请奖励补发"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={adjusting}
            onClick={() => void handleAdjust()}
            className="rounded-xl bg-amber-500/70 px-4 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            {adjusting ? '执行中…' : '确认'}
          </button>
        </div>
        {adjustMsg && (
          <div className={`mt-2 text-xs ${adjustMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {adjustMsg.text}
          </div>
        )}

        {/* 积分流水 */}
        {detail.records.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] text-slate-500">近 50 条积分记录</div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
              {detail.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div>
                    <div className="text-slate-300">{r.description}</div>
                    <div className="text-[10px] text-slate-600">{formatDate(r.created_at)}</div>
                  </div>
                  <span className={`font-bold tabular-nums ${r.amount > 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                    {r.amount > 0 ? '+' : ''}{r.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 历史测算 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">历史测算记录（{detail.readings.length} 条）</h2>
        {detail.readings.length === 0 ? (
          <div className="text-xs text-slate-600">暂无测算记录</div>
        ) : (
          <div className="space-y-2">
            {detail.readings.map((r) => {
              const isExpanded = expandedReadingId === r.id
              const inputData = r.input_data as UserInput | HeBanUserInput | null
              return (
                <div key={r.id} className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedReadingId(isExpanded ? null : r.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200">{r.name || '未命名'}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {formatDate(r.created_at)}
                        {r.ai_report ? ' · 有AI解读' : ' · 无AI解读'}
                        {inputData && isHeBanInputData(inputData) ? ` · 合盘（${(inputData as HeBanUserInput).relation}）` : ''}
                      </div>
                    </div>
                    <svg className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {isExpanded && (
                    <ReadingExpandedContent
                      r={r}
                      onViewFullReport={setFullscreenReading}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AI 解读全屏弹窗 */}
      {fullscreenReading && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-amber-400/20 bg-[#0f0e0b] shadow-2xl">
            {/* 弹窗顶栏 */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-amber-100">{fullscreenReading.name || '未命名'}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{formatDate(fullscreenReading.created_at)} · AI 解读全文</div>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenReading(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {/* 解读内容 */}
            <div className="px-6 py-5">
              <div
                className="prose prose-invert prose-sm ai-report-prose max-w-none leading-relaxed rounded-2xl border border-amber-900/35 p-5 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)]"
                style={{ fontFamily: AI_READING_SERIF, ...READING_PANEL_SURFACE_STYLE }}
              >
                <AiReportMarkdown markdown={normalizeAiReportMarkdown(fullscreenReading.ai_report ?? '')} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
