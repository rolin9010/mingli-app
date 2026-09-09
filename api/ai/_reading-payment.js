export function hasEnoughPoints(balance, cost) {
  return Number.isInteger(balance) && Number.isInteger(cost) && cost > 0 && balance >= cost
}

export function hasSuccessfulReading(content) {
  return typeof content === 'string' && content.trim().length > 0
}

/**
 * 深度解读必须含有所有约定主题，才视为可计费结果。
 * 这层校验在服务端完成，避免客户端展示出缺失章节的报告后仍扣除积分。
 */
export function hasCompleteReading(content, type, mode) {
  if (!hasSuccessfulReading(content) || mode !== 'deep') return hasSuccessfulReading(content)

  const expectedCount = type === 'heban' ? 5 : 7
  const labels = ['一', '二', '三', '四', '五', '六', '七']

  return labels.slice(0, expectedCount).every((label, index) => {
    const numericLabel = index + 1
    const heading = new RegExp(
      `^#{2,6}\\s*(?:\\*\\*\\s*)?主题\\s*(?:${label}|${numericLabel})(?:\\s*[：:].*)?(?:\\s*\\*\\*)?\\s*$`,
      'm',
    )
    return heading.test(content)
  })
}

export function toReadingSse(content) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`
}
