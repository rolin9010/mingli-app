import assert from 'node:assert/strict'
import test from 'node:test'
import { hasCompleteReading, hasEnoughPoints, hasSuccessfulReading, toReadingSse } from './_reading-payment.js'

test('failed or empty AI output is never eligible for a points debit', () => {
  assert.equal(hasSuccessfulReading(''), false)
  assert.equal(hasSuccessfulReading('   '), false)
  assert.equal(hasSuccessfulReading(undefined), false)
  assert.equal(hasSuccessfulReading('有效解读内容'), true)
})

test('the preflight balance check accepts only an affordable reading', () => {
  assert.equal(hasEnoughPoints(5, 3), true)
  assert.equal(hasEnoughPoints(2, 3), false)
  assert.equal(hasEnoughPoints(undefined, 3), false)
  assert.equal(hasEnoughPoints(5, 0), false)
})

test('a deep reading without the body-care topic is not eligible for a points debit', () => {
  const incomplete = [
    '### 主题一：整体格局',
    '### 主题二：事业方向',
    '### 主题三：财富节奏',
    '### 主题四：情感关系',
    '### 主题五：学习成长',
    '### 主题七：行动建议',
  ].join('\n\n')
  const complete = `${incomplete.replace('### 主题七：行动建议', '### **主题六：身体养护**\n\n### 主题七：行动建议')}`

  assert.equal(hasCompleteReading(incomplete, 'single', 'deep'), false)
  assert.equal(hasCompleteReading(complete, 'single', 'deep'), true)
  assert.equal(hasCompleteReading('普通快速解读', 'single', 'quick'), true)
})

test('successful reading keeps the SSE shape expected by the client', () => {
  const sse = toReadingSse('第一段\n第二段')
  assert.match(sse, /^data: /)
  assert.match(sse, /data: \[DONE\]/)
  const payload = JSON.parse(sse.split('\n')[0].slice(6))
  assert.equal(payload.choices[0].delta.content, '第一段\n第二段')
})
