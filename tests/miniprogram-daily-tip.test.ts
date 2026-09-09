import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPersonalLifeGuidance,
  buildPersonalSongmianTip,
  buildPersonalTipMeta,
  buildPublicSongmianTip,
  containsGarbledText,
  getDailyPracticeFocus,
  getSeasonalElementAssessment,
  getShanghaiToday,
  getSolarTermContext,
  isCompleteDailyTip,
  sanitizeDailyTip,
} from '../api/miniprogram-daily-tip.js'

test('Shanghai date helper returns date, weekday, season and current solar term', () => {
  const today = getShanghaiToday(new Date('2026-07-15T01:00:00.000Z'))
  assert.equal(today.dateKey, '20260715')
  assert.equal(today.dateIso, '2026-07-15')
  assert.equal(today.season, '夏季')
  assert.equal(today.solarTerm, '小暑')
  assert.equal(today.nextSolarTerm, '大暑')
  assert.ok(today.weekday)
})

test('solar-term season changes at the traditional seasonal boundary', () => {
  assert.equal(getSolarTermContext(2026, 8, 6).season, '夏季')
  const startOfAutumn = getSolarTermContext(2026, 8, 7)
  assert.equal(startOfAutumn.name, '立秋')
  assert.equal(startOfAutumn.season, '秋季')
  assert.equal(startOfAutumn.isExactDay, true)
})

test('Songmian method focus rotates across consecutive dates', () => {
  assert.notDeepEqual(getDailyPracticeFocus('20260803'), getDailyPracticeFocus('20260804'))
})

test('public Songmian tip is complete without model generation', () => {
  const today = getShanghaiToday(new Date('2026-08-16T01:00:00.000Z'))
  const content = buildPublicSongmianTip(today)
  assert.equal(isCompleteDailyTip(content, 'public'), true)
  assert.match(content, /秋季/)
  assert.match(content, /立秋/)
  assert.match(content, /3分钟通用练习/)
  assert.match(content, /今夜一句/)
})

test('seasonal weighting changes the internal balance assessment', () => {
  const elements = [
    { element: '木', percent: 20 },
    { element: '火', percent: 20 },
    { element: '土', percent: 20 },
    { element: '金', percent: 20 },
    { element: '水', percent: 20 },
  ]
  assert.equal(getSeasonalElementAssessment(elements, '春季').dominant, '木')
  assert.equal(getSeasonalElementAssessment(elements, '夏季').dominant, '火')
  assert.equal(getSeasonalElementAssessment(elements, '秋季').dominant, '金')
  assert.equal(getSeasonalElementAssessment(elements, '冬季').dominant, '水')
})

test('personal tips vary with private structure but do not expose source terms', () => {
  const today = getShanghaiToday(new Date('2026-08-16T01:00:00.000Z'))
  const outward = buildPersonalSongmianTip([
    { element: '木', percent: 44 }, { element: '火', percent: 18 },
    { element: '土', percent: 16 }, { element: '金', percent: 12 }, { element: '水', percent: 10 },
  ], today)
  const storing = buildPersonalSongmianTip([
    { element: '木', percent: 10 }, { element: '火', percent: 12 },
    { element: '土', percent: 16 }, { element: '金', percent: 18 }, { element: '水', percent: 44 },
  ], today)

  assert.notEqual(outward, storing)
  assert.equal(isCompleteDailyTip(outward, 'personal'), true)
  assert.equal(isCompleteDailyTip(storing, 'personal'), true)
  for (const marker of ['工作生活建议', '工作：', '生活：', '健康：', '饮食：']) {
    assert.match(outward, new RegExp(marker))
    assert.match(storing, new RegExp(marker))
  }
  assert.doesNotMatch(outward, /五行|八字|命理|百分比|旺衰/)
  assert.doesNotMatch(storing, /五行|八字|命理|百分比|旺衰/)
})

test('work, life, health and diet advice combine season with different personal states', () => {
  const today = getShanghaiToday(new Date('2026-08-16T01:00:00.000Z'))
  const outward = buildPersonalLifeGuidance([
    { element: '木', percent: 44 }, { element: '火', percent: 18 },
    { element: '土', percent: 16 }, { element: '金', percent: 12 }, { element: '水', percent: 10 },
  ], today)
  const storing = buildPersonalLifeGuidance([
    { element: '木', percent: 10 }, { element: '火', percent: 12 },
    { element: '土', percent: 16 }, { element: '金', percent: 18 }, { element: '水', percent: 44 },
  ], today)

  assert.match(outward.work, /时令由外放转向收敛/)
  assert.match(outward.work, /推进感较明显/)
  assert.match(storing.work, /拆成十分钟可启动的第一步/)
  assert.notDeepEqual(outward, storing)
  for (const guidance of [outward, storing]) {
    assert.ok(guidance.work.length > 60)
    assert.ok(guidance.life.length > 60)
    assert.ok(guidance.health.length > 60)
    assert.ok(guidance.diet.length > 60)
  }
})

test('personal metadata makes the private structure visible through review-safe rhythm labels', () => {
  const today = getShanghaiToday(new Date('2026-08-16T01:00:00.000Z'))
  const outward = buildPersonalTipMeta([
    { element: '木', percent: 44 }, { element: '火', percent: 18 },
    { element: '土', percent: 16 }, { element: '金', percent: 12 }, { element: '水', percent: 10 },
  ], today)
  const storing = buildPersonalTipMeta([
    { element: '木', percent: 10 }, { element: '火', percent: 12 },
    { element: '土', percent: 16 }, { element: '金', percent: 18 }, { element: '水', percent: 44 },
  ], today)

  assert.equal(outward.primaryLabel, '生发')
  assert.equal(outward.supportLabel, '涵养')
  assert.equal(storing.primaryLabel, '涵养')
  assert.equal(storing.supportLabel, '生发')
  assert.notEqual(outward.interplay, storing.interplay)
})

test('public and personal content require their complete structures', () => {
  const publicTip = `今日时令\n${'顺应时令安排节奏。'.repeat(8)}\n3分钟通用练习\n${'缓慢呼吸并逐层放松。'.repeat(6)}\n今夜一句\n${'调暗屏幕安顿身体。'.repeat(5)}`
  const personalTip = `个人节律画像\n${'生发较突出，涵养需要照顾。'.repeat(10)}\n今天对你的影响\n${'今天适合收拢注意力。'.repeat(10)}\n专属松眠练习\n${'逐层扫描并松开力量。'.repeat(9)}\n补足动作\n${'留出两分钟无输入时间。'.repeat(9)}\n工作生活建议\n工作：${'收束一件已开始的事。'.repeat(4)}\n生活：${'留出十分钟无输入时间。'.repeat(4)}\n健康：${'做小幅度舒展并慢走。'.repeat(4)}\n饮食：${'规律吃饭并主动饮水。'.repeat(4)}\n今夜收神\n${'先调暗光线再安静呼吸。'.repeat(8)}\n觉察与创造\n${'写下身体最先松开的地方。'.repeat(7)}`
  assert.equal(isCompleteDailyTip(publicTip, 'public'), true)
  assert.equal(isCompleteDailyTip('今日时令\n顺应时令。\n3分钟通用练习\n慢慢呼吸。', 'public'), false)
  assert.equal(
    isCompleteDailyTip(personalTip, 'personal'),
    true,
  )
})

test('sensitive terms and duplicate headings are cleaned', () => {
  assert.equal(sanitizeDailyTip('\u4e94\u884c与\u516b\u5b57'), '传统智慧与传统智慧')
  assert.equal(
    sanitizeDailyTip('表达变体编号：d3f66299。请重写以下匿名练习草案：\n\n个人节律画像'),
    '个人节律画像',
  )
  assert.equal(
    sanitizeDailyTip('今日节律：今日节律：顺应时令。\n松眠练习 松眠练习 缓慢呼吸。'),
    '今日节律\n顺应时令。\n松眠练习\n缓慢呼吸。',
  )
  assert.equal(containsGarbledText('内容???未完成'), true)
  assert.equal(containsGarbledText('内容�未完成'), true)
  assert.equal(sanitizeDailyTip('工作建议???正常内容�'), '工作建议正常内容')
})
