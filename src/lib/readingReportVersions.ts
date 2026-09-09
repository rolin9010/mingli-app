export type AiReadingMode = 'quick' | 'deep'

export type ReadingReportVersions = {
  quick: string | null
  deep: string | null
}

const QUICK_START = '<!-- MINGLI_AI_QUICK_START -->'
const QUICK_END = '<!-- MINGLI_AI_QUICK_END -->'
const DEEP_START = '<!-- MINGLI_AI_DEEP_START -->'
const DEEP_END = '<!-- MINGLI_AI_DEEP_END -->'

function cleanReport(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ''
  return text || null
}

function extractSection(source: string, startMarker: string, endMarker: string): string | null {
  const start = source.indexOf(startMarker)
  if (start < 0) return null
  const contentStart = start + startMarker.length
  const end = source.indexOf(endMarker, contentStart)
  if (end < 0) return null
  return cleanReport(source.slice(contentStart, end))
}

/** Legacy reports with several numbered topics are deep readings. */
export function isDeepReadingReport(report: string): boolean {
  const topics = new Set<string>()
  const chineseNumbers: Record<string, string> = {
    '一': '1',
    '二': '2',
    '三': '3',
    '四': '4',
    '五': '5',
    '六': '6',
    '七': '7',
  }
  const matcher = /主题\s*[第]?\s*([一二三四五六七1-7])/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(report)) !== null) {
    const raw = match[1]!
    topics.add(chineseNumbers[raw] ?? raw)
  }
  return topics.size >= 3
}

/** Parses both the new dual-version format and old single-report records. */
export function parseReadingReportVersions(stored: string | null | undefined): ReadingReportVersions {
  const source = cleanReport(stored)
  if (!source) return { quick: null, deep: null }

  const quick = extractSection(source, QUICK_START, QUICK_END)
  const deep = extractSection(source, DEEP_START, DEEP_END)
  if (quick || deep) return { quick, deep }

  return isDeepReadingReport(source)
    ? { quick: null, deep: source }
    : { quick: source, deep: null }
}

/** Keeps a single report as legacy Markdown; bundles only when both versions exist. */
export function serializeReadingReportVersions(versions: ReadingReportVersions): string {
  const quick = cleanReport(versions.quick)
  const deep = cleanReport(versions.deep)
  if (quick && !deep) return quick
  if (deep && !quick) return deep
  if (!quick && !deep) return ''

  return [
    QUICK_START,
    quick,
    QUICK_END,
    '',
    DEEP_START,
    deep,
    DEEP_END,
  ].join('\n')
}

export function mergeReadingReportVersion(
  stored: string | null | undefined,
  mode: AiReadingMode,
  report: string,
): string {
  const versions = parseReadingReportVersions(stored)
  return serializeReadingReportVersions({ ...versions, [mode]: cleanReport(report) })
}

export function preferredReadingReport(stored: string | null | undefined): string {
  const versions = parseReadingReportVersions(stored)
  return versions.deep ?? versions.quick ?? ''
}

/** 仅有普通解读时才应提供继续深度解读。 */
export function canUpgradeToDeepReading(stored: string | null | undefined): boolean {
  const versions = parseReadingReportVersions(stored)
  return Boolean(versions.quick && !versions.deep)
}
