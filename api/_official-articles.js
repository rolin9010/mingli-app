function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

export function isOfficialArticleUrl(value) {
  return typeof value === 'string'
    && /^https:\/\/mp\.weixin\.qq\.com\/(?:s(?:\/|\?)|mp\/appmsg\/show)/i.test(value.trim())
}

function normalizePublishedAt(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000)
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function normalizeManualArticles(value) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const title = cleanText(item.title, 80)
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    const publishedAt = normalizePublishedAt(item.publishedAt ?? item.publishTime)
    if (!title || !isOfficialArticleUrl(url) || !publishedAt) return []

    return [{
      id: cleanText(item.id, 100) || `manual-${publishedAt}-${index}`,
      title,
      digest: cleanText(item.digest ?? item.summary, 180),
      url,
      publishedAt,
    }]
  }).sort((left, right) => right.publishedAt - left.publishedAt)
}

export function flattenWeChatPublishedItems(value) {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, itemIndex) => {
    if (!item || typeof item !== 'object') return []
    const articleId = cleanText(item.article_id, 100) || `wechat-${itemIndex}`
    const publishedAt = normalizePublishedAt(item.update_time)
    const newsItems = Array.isArray(item.content?.news_item) ? item.content.news_item : []

    return newsItems.flatMap((newsItem, articleIndex) => {
      const title = cleanText(newsItem?.title, 80)
      const url = typeof newsItem?.url === 'string' ? newsItem.url.trim() : ''
      if (!title || !isOfficialArticleUrl(url) || !publishedAt) return []

      return [{
        id: `${articleId}-${articleIndex}`,
        title,
        digest: cleanText(newsItem.digest, 180),
        url,
        publishedAt,
      }]
    })
  }).sort((left, right) => right.publishedAt - left.publishedAt)
}
