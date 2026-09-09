import { normalizeAiReportMarkdown, parseAiOpeningBlocks } from './aiReportMarkdown'

export const TOPIC_TABS = [
  { key: 'greeting', label: '开篇', icon: '✦' },
  { key: 'topic1', label: '能量画像', icon: '🌊' },
  { key: 'topic2', label: '情绪特点', icon: '💫' },
  { key: 'topic3', label: '人际关系', icon: '🤝' },
  { key: 'topic4', label: '事业方向', icon: '🧭' },
  { key: 'topic5', label: '子女相关', icon: '🌱' },
  { key: 'topic6', label: '身体养护', icon: '🌿' },
  { key: 'topic7', label: '行动指南', icon: '🌙' },
] as const

export type TopicTabKey = (typeof TOPIC_TABS)[number]['key']

/** 新生成报告与历史报告必须按同一规则切分主题。 */
export function parseAiReportTopics(markdown: string): Record<TopicTabKey, string> {
  const normalized = normalizeAiReportMarkdown(markdown)
  const { headerNote, greeting, rest } = parseAiOpeningBlocks(normalized)
  const greetingParts: string[] = []
  if (headerNote) greetingParts.push(`*${headerNote}*`)
  if (greeting) greetingParts.push(greeting)

  const sections: Record<string, string> = {}
  const chineseNums: Record<string, string> = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7',
  }
  const topicRegex = /^#{2,6}\s*(?:\*\*\s*)?主题\s*([一二三四五六七1-7])[^\n]*$/gm
  const matches: { index: number; num: string }[] = []
  let match: RegExpExecArray | null

  while ((match = topicRegex.exec(rest)) !== null) {
    const rawNum = match[1]!
    matches.push({ index: match.index, num: chineseNums[rawNum] ?? rawNum })
  }

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index]!.index
    const end = index + 1 < matches.length ? matches[index + 1]!.index : rest.length
    sections[matches[index]!.num] = rest.slice(start, end).trim()
  }

  return {
    greeting: greetingParts.join('\n\n') || '（AI 还未生成开篇内容）',
    topic1: sections['1'] ?? '',
    topic2: sections['2'] ?? '',
    topic3: sections['3'] ?? '',
    topic4: sections['4'] ?? '',
    topic5: sections['5'] ?? '',
    topic6: sections['6'] ?? '',
    topic7: sections['7'] ?? '',
  }
}
