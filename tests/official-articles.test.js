import test from 'node:test'
import assert from 'node:assert/strict'
import {
  flattenWeChatPublishedItems,
  isOfficialArticleUrl,
  normalizeManualArticles,
} from '../api/_official-articles.js'

test('manual official account articles are validated and sorted newest first', () => {
  const articles = normalizeManualArticles([
    {
      title: '旧文章',
      url: 'https://mp.weixin.qq.com/s/old',
      publishedAt: '2026-08-01T08:00:00+08:00',
    },
    {
      title: '新文章',
      url: 'https://mp.weixin.qq.com/s/new',
      publishedAt: '2026-08-20T08:00:00+08:00',
    },
    {
      title: '外部链接',
      url: 'https://example.com/article',
      publishedAt: '2026-08-21T08:00:00+08:00',
    },
  ])

  assert.deepEqual(articles.map((article) => article.title), ['新文章', '旧文章'])
})

test('published WeChat messages flatten multi-article issues and preserve order by time', () => {
  const articles = flattenWeChatPublishedItems([
    {
      article_id: 'issue-old',
      update_time: 1_775_001_600,
      content: { news_item: [{ title: '旧文章', url: 'https://mp.weixin.qq.com/s/old' }] },
    },
    {
      article_id: 'issue-new',
      update_time: 1_776_729_600,
      content: {
        news_item: [
          { title: '新文章 A', digest: '摘要', url: 'https://mp.weixin.qq.com/s/new-a' },
          { title: '新文章 B', url: 'https://mp.weixin.qq.com/s/new-b' },
        ],
      },
    },
  ])

  assert.deepEqual(articles.map((article) => article.title), ['新文章 A', '新文章 B', '旧文章'])
  assert.equal(articles[0]?.digest, '摘要')
  assert.equal(articles[0]?.publishedAt, 1_776_729_600_000)
})

test('only WeChat official account article links are accepted', () => {
  assert.equal(isOfficialArticleUrl('https://mp.weixin.qq.com/s/example'), true)
  assert.equal(isOfficialArticleUrl('https://mp.weixin.qq.com/s?__biz=example'), true)
  assert.equal(isOfficialArticleUrl('http://mp.weixin.qq.com/s/example'), false)
  assert.equal(isOfficialArticleUrl('https://example.com/s/example'), false)
})
