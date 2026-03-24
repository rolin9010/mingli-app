import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchAIReading, buildReadingPrompt } from '../lib/ai'
import type { ReportResults, UserInput } from '../lib/types'

interface Props {
  input: UserInput
  results: ReportResults
}

export default function AIReading({ input, results }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  const run = async () => {
    setLoading(true)
    setError('')
    setText('')
    setStarted(true)
    try {
      const prompt = buildReadingPrompt(input, results)
      const result = await fetchAIReading(prompt)
      setText(result)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '解读失败，请重试'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
          ✦
        </div>
        {!loading && (
          <button
            type="button"
            onClick={run}
            className="rounded-xl border border-amber-400/50 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/25"
          >
            {started ? '重新生成解读' : '生成 AI 解读'}
          </button>
        )}
      </div>

      {!started && (
        <p className="text-sm text-slate-200/70">
          点击「生成 AI 解读」将在本页请求跨体系融合分析（需本地代理 API 可用）。生成后可滚动查看 Markdown 排版结果。
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-200/70">
          <svg className="h-4 w-4 animate-spin text-amber-300" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          正在召唤 AI 大师解读中，请稍候…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
          {error}
          <button type="button" onClick={run} className="ml-3 underline hover:text-rose-100">
            重试
          </button>
        </div>
      )}

      {!loading && text ? (
        <div className="prose prose-invert prose-sm max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-headings:font-semibold prose-headings:text-amber-300 prose-li:my-1 prose-li:text-slate-300 prose-ol:my-2 prose-p:my-2 prose-p:leading-relaxed prose-p:text-slate-300 prose-strong:text-amber-100 prose-ul:my-2">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : null}

      {!loading && text ? (
        <div className="mt-4 text-xs text-slate-200/40">
          以上解读由 AI 生成，仅供参考，重大决策请结合实际情况判断。
        </div>
      ) : null}
    </div>
  )
}
