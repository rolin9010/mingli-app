import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canUpgradeToDeepReading,
  mergeReadingReportVersion,
  parseReadingReportVersions,
  preferredReadingReport,
} from '../src/lib/readingReportVersions.js'

test('legacy quick reports remain readable without rewriting', () => {
  const report = '普通解读内容'
  assert.deepEqual(parseReadingReportVersions(report), { quick: report, deep: null })
  assert.equal(preferredReadingReport(report), report)
})

test('legacy topic-based reports are classified as deep readings', () => {
  const report = ['### 主题一', 'A', '### 主题二', 'B', '### 主题七', 'C'].join('\n')
  assert.deepEqual(parseReadingReportVersions(report), { quick: null, deep: report })
})

test('quick and deep reports are both preserved in one stored value', () => {
  const quick = '普通解读'
  const deep = ['### 主题一', 'A', '### 主题二', 'B', '### 主题七', 'C'].join('\n')
  const stored = mergeReadingReportVersion(mergeReadingReportVersion(null, 'quick', quick), 'deep', deep)

  assert.deepEqual(parseReadingReportVersions(stored), { quick, deep })
  assert.equal(preferredReadingReport(stored), deep)
})

test('replacing one version never removes the other version', () => {
  const stored = mergeReadingReportVersion(
    mergeReadingReportVersion(null, 'quick', '旧普通版'),
    'deep',
    '旧深度版',
  )
  const updated = mergeReadingReportVersion(stored, 'quick', '新普通版')

  assert.deepEqual(parseReadingReportVersions(updated), {
    quick: '新普通版',
    deep: '旧深度版',
  })
})

test('deep upgrade is offered only when a quick report exists without a deep report', () => {
  const quickOnly = mergeReadingReportVersion(null, 'quick', '普通解读')
  const both = mergeReadingReportVersion(quickOnly, 'deep', '深度解读')

  assert.equal(canUpgradeToDeepReading(quickOnly), true)
  assert.equal(canUpgradeToDeepReading(both), false)
  assert.equal(canUpgradeToDeepReading(null), false)
})
