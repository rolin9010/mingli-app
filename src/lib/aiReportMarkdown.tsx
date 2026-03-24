import type { CSSProperties, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'

/** AI 解读正文：与全站 Noto Serif SC 一致 */
export const AI_READING_SERIF = '"Noto Serif SC","Songti SC","SimSun","STSong","Source Han Serif SC",serif'

/** 解读区星点层（与全页一致：2～3px 光点，避免 1px 不可见） */
export const STARFIELD_BG =
  'radial-gradient(2px 2px at 8% 12%, rgba(255,255,255,0.75), transparent),radial-gradient(2.5px 2.5px at 22% 28%, rgba(186,230,253,0.55), transparent),radial-gradient(2px 2px at 38% 8%, rgba(255,255,255,0.4), transparent),radial-gradient(3px 3px at 52% 42%, rgba(255,255,255,0.8), transparent),radial-gradient(2px 2px at 68% 18%, rgba(196,181,253,0.45), transparent),radial-gradient(2px 2px at 82% 55%, rgba(255,255,255,0.38), transparent),radial-gradient(2px 2px at 92% 22%, rgba(147,197,253,0.42), transparent),radial-gradient(2px 2px at 15% 72%, rgba(255,255,255,0.35), transparent),radial-gradient(2px 2px at 45% 88%, rgba(255,255,255,0.42), transparent),radial-gradient(2.5px 2.5px at 72% 78%, rgba(255,255,255,0.62), transparent),radial-gradient(2px 2px at 28% 48%, rgba(255,255,255,0.32), transparent),radial-gradient(2px 2px at 58% 62%, rgba(255,255,255,0.36), transparent),radial-gradient(2px 2px at 88% 92%, rgba(255,255,255,0.34), transparent)'

/** 纯深色底 + 星点（用于 Markdown 阅读区） */
export const READING_PANEL_SURFACE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(6, 7, 10, 0.92)',
  backgroundImage: STARFIELD_BG,
}

/** 文字背景渐变：#6A5B29 实色 → 向上透明 */
const MARKER_BG = '106, 91, 41'

/** 记号笔渐变 + 斜边（行内盒与 padding 见 index.css .mingli-marker-highlight） */
const markerParallelogramStyle: CSSProperties = {
  /* 禁用 clip-path：在行内换行+中文场景会裁切首尾字，造成“缺字/断行空白” */
  backgroundImage: `linear-gradient(to top,
    rgba(${MARKER_BG}, 1) 0%,
    rgba(${MARKER_BG}, 0.55) 38%,
    rgba(${MARKER_BG}, 0.12) 72%,
    rgba(${MARKER_BG}, 0) 100%)`,
  backgroundSize: '100% calc(50% + 2px)',
  backgroundPosition: 'center bottom',
  backgroundRepeat: 'no-repeat',
}

/** 高亮字色 */
const MARKER_TEXT = '#EDD082'

function MarkerParallelogram({ children }: { children: ReactNode; variant: 'strong' | 'em' }) {
  return (
    <span
      className="mingli-marker-highlight inline align-baseline font-bold not-italic"
      style={{ ...markerParallelogramStyle, color: MARKER_TEXT, lineHeight: 'inherit' }}
    >
      {children}
    </span>
  )
}

function stripGreetingTags(full: string): string {
  // 兜底：模型可能错误地把 [GREETING] 当作普通文本输出，这里直接清理掉，确保前端不再显示该标签。
  return full
    .replace(/\*\*\[\s*GREETING\s*\]\*\*/gi, '')
    .replace(/\[\/?\s*GREETING\s*\]/gi, '')
    .trim()
}

/** 解析 AI 开篇分块；[GREETING]（或首段问候）与旧版 [TAGLINE] 合并为一段展示 */
export function parseAiOpeningBlocks(full: string): {
  headerNote?: string
  greeting?: string
  rest: string
} {
  let s = full.trim()
  const take = (tag: string): string | undefined => {
    const re = new RegExp(`\\[${tag}\\]\\s*([\\s\\S]*?)\\s*\\[\\/${tag}\\]`, 'i')
    const m = s.match(re)
    if (!m) return undefined
    const inner = m[1]!.trim()
    s = s.replace(re, '').trim()
    return inner || undefined
  }
  const headerNote = take('HEADER_NOTE')
  let greeting = take('GREETING')
  const taglineLegacy = take('TAGLINE')
  if (taglineLegacy) {
    greeting = greeting
      ? `${greeting.replace(/\n+/g, ' ')} ${taglineLegacy.replace(/\n+/g, ' ')}`.trim()
      : taglineLegacy.replace(/\n+/g, ' ')
  } else if (greeting) {
    greeting = greeting.replace(/\n+/g, ' ')
  }

  // 如果模型没有按 [GREETING] 标签输出，则尝试把 HEADER_NOTE 后、第一个「##」前的首段当作问候段
  if (!greeting && !taglineLegacy) {
    const firstSectionIdx = s.search(/\n##\s+/)
    if (firstSectionIdx !== -1) {
      const maybeGreeting = s.slice(0, firstSectionIdx).trim()
      if (maybeGreeting) {
        greeting = stripGreetingTags(maybeGreeting).replace(/\n+/g, ' ')
        s = s.slice(firstSectionIdx).trim()
      }
    }
  }

  if (greeting) greeting = stripGreetingTags(greeting).replace(/\n+/g, ' ')
  return { headerNote, greeting, rest: s.trim() }
}

/** 不再展示固定过渡句（旧报告可能仍含） */
export function stripChaijieSentence(full: string): string {
  return full
    .replace(/[「」\s]*以下为你做详细拆解：\s*[」」]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 旧版报告末尾可能带「图片描述：」长提示，不再展示 */
export function stripLegacyImagePromptBlock(full: string): string {
  const m1 = full.lastIndexOf('图片描述：')
  const m2 = full.lastIndexOf('图片描述:')
  const idx = Math.max(m1, m2)
  if (idx === -1) return full.trim()
  let head = full.slice(0, idx).trim()
  head = head.replace(/\n*##\s*八[^\n]*\s*$/m, '').trim()
  head = head.replace(/\n*#{1,6}\s*八[^\n]*\s*$/m, '').trim()
  return head
}

/** 解读正文统一预处理（过渡句 + 图片描述块） */
export function normalizeAiReportMarkdown(full: string): string {
  return formatAiSubheadingLineBreaks(
    stripGreetingTags(stripLegacyImagePromptBlock(stripChaijieSentence(full))),
  )
}

/**
 * 将常见“小标题 + 正文同一行”的 AI 输出改为换行展示，提升可读性。
 * 例：
 * - "1. 五行体质画像 你的五行体质..."
 * - "4. 情志倾向与调心建议 五行缺水..."
 * - "**问题指向**：思虑过多..."
 */
function formatAiSubheadingLineBreaks(full: string): string {
  return full
    .replace(/(\*\*\s*\d+\.\s*[^*\n]{2,40}\s*\*\*)\s+(?=[^\n])/g, '$1\n')
    .replace(/(^|\n)(\d+\.\s*[^\n]{2,24}?)(\s+)(?=[^\n])/g, '$1$2\n')
    .replace(/(\*\*[^*\n]{2,30}\*\*)\s*[：:]\s*/g, '$1：\n')
    .replace(/\n{3,}/g, '\n\n')
}

/** 开篇合并段：与正文相同的 *斜体* / **粗体** → 记号笔（换行按行断开） */
const openingGreetingMarkdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-sm leading-8 text-[#D1D5DB]">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="inline align-baseline font-bold not-italic">
      <MarkerParallelogram variant="strong">{children}</MarkerParallelogram>
    </strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="inline align-baseline not-italic">
      <MarkerParallelogram variant="em">{children}</MarkerParallelogram>
    </em>
  ),
}

export const aiMarkdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-8 mb-3 border-l border-amber-400 pl-3 text-left text-base font-semibold tracking-wide text-amber-300">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-5 mb-1 inline text-sm font-semibold text-white">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-left text-sm leading-8 text-[#D1D5DB]">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-3 space-y-3 list-none pl-0">{children}</ul>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="flex items-start gap-2.5 text-left text-sm leading-8 text-[#D1D5DB]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 self-start rounded-full bg-amber-400/90" aria-hidden />
      <div className="min-w-0 flex-1 [&>p]:my-1">{children}</div>
    </li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="inline align-baseline font-bold not-italic">
      <MarkerParallelogram variant="strong">{children}</MarkerParallelogram>
    </strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="inline align-baseline not-italic">
      <MarkerParallelogram variant="em">{children}</MarkerParallelogram>
    </em>
  ),
  hr: () => <hr className="my-6 border-slate-600/40" />,
}

/** AI 解读全文：开篇分块 + Markdown（自动 strip 旧版图片描述块） */
export function AiReportMarkdown({ markdown }: { markdown: string }) {
  const cleaned = normalizeAiReportMarkdown(markdown)
  const { headerNote, greeting, rest } = parseAiOpeningBlocks(cleaned)
  const hasContent = Boolean(headerNote || greeting || rest.trim().length > 0)
  return (
    <>
      {headerNote ? (
        <p className="mb-3 text-xs font-extralight leading-relaxed text-slate-500/95">{headerNote}</p>
      ) : null}
      {hasContent ? (
        <h2 className="mb-4 text-center text-lg font-bold tracking-wide text-amber-100 sm:text-xl">
          AI 大师解读
        </h2>
      ) : null}
      {greeting ? (
        <ReactMarkdown components={openingGreetingMarkdownComponents}>{greeting}</ReactMarkdown>
      ) : null}
      <ReactMarkdown components={aiMarkdownComponents}>{rest}</ReactMarkdown>
    </>
  )
}
