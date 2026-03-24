import type { BirthDateInput, BaziResult, UserInput } from '../types'
import { parseDayMasterFromDayPillar } from './dayMaster'
import { Lunar, Solar } from 'lunar-javascript'
import { hasBirthLocationForTrueSolar, lookupGeoForTrueSolar, toSolarTime } from '../geo'
const stemElement: Record<string, '木'|'火'|'土'|'金'|'水'> = {
甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}

// 地支藏干表（主气7/中气3/余气1）
const branchHidden: Record<string, { stem: string; weight: number }[]> = {
子: [{ stem: '癸', weight: 7 }],
丑: [{ stem: '己', weight: 7 }, { stem: '癸', weight: 3 }, { stem: '辛', weight: 1 }],
寅: [{ stem: '甲', weight: 7 }, { stem: '丙', weight: 3 }, { stem: '戊', weight: 1 }],
卯: [{ stem: '乙', weight: 7 }],
辰: [{ stem: '戊', weight: 7 }, { stem: '乙', weight: 3 }, { stem: '癸', weight: 1 }],
巳: [{ stem: '丙', weight: 7 }, { stem: '庚', weight: 3 }, { stem: '戊', weight: 1 }],
午: [{ stem: '丁', weight: 7 }, { stem: '己', weight: 3 }],
未: [{ stem: '己', weight: 7 }, { stem: '丁', weight: 3 }, { stem: '乙', weight: 1 }],
申: [{ stem: '庚', weight: 7 }, { stem: '壬', weight: 3 }, { stem: '戊', weight: 1 }],
酉: [{ stem: '辛', weight: 7 }],
戌: [{ stem: '戊', weight: 7 }, { stem: '辛', weight: 3 }, { stem: '丁', weight: 1 }],
亥: [{ stem: '壬', weight: 7 }, { stem: '甲', weight: 3 }],
}

// 三合局
const threeHarmony: { branches: string[]; element: '木'|'火'|'土'|'金'|'水'; bonus: number }[] = [
{ branches: ['寅', '午', '戌'], element: '火', bonus: 5 },
{ branches: ['申', '子', '辰'], element: '水', bonus: 5 },
{ branches: ['巳', '酉', '丑'], element: '金', bonus: 5 },
{ branches: ['亥', '卯', '未'], element: '木', bonus: 5 },
]

// 三会局（方局）
const threeDirection: { branches: string[]; element: '木'|'火'|'土'|'金'|'水'; bonus: number }[] = [
{ branches: ['寅', '卯', '辰'], element: '木', bonus: 6 },
{ branches: ['巳', '午', '未'], element: '火', bonus: 6 },
{ branches: ['申', '酉', '戌'], element: '金', bonus: 6 },
{ branches: ['亥', '子', '丑'], element: '水', bonus: 6 },
]

function parseStemBranch(name: string): { stem?: string; branch?: string } {
  const stem = name.match(/[甲乙丙丁戊己庚辛壬癸]/)?.[0]
  const branch = name.match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]
  return { stem, branch }
}

export type BaziLunarContext = {
  lunar: any
  eightChar: any
  usedTrueSolar: boolean
  gregorian: { year: number; month: number; day: number; hour: number; minute: number }
}

/** 与排盘/五行计算共用的 Lunar + EightChar（避免重复算两次） */
type BaziLocationArg = Pick<UserInput, 'country' | 'province' | 'city' | 'district' | 'useSolarTime'>

export function computeBaziContext(
  birth: BirthDateInput,
  calendarType: '公历' | '农历' = '公历',
  location?: BaziLocationArg,
): BaziLunarContext {
  let { year, month, day, hour } = birth
  let minute = birth.minute ?? 0
  if (calendarType === '农历') {
    const solar = (Lunar as any).fromYmd(year, month, day).getSolar()
    year = solar.getYear()
    month = solar.getMonth()
    day = solar.getDay()
  }

  const useTrueSolar =
    location?.useSolarTime !== false &&
    Boolean(location && hasBirthLocationForTrueSolar(location) && lookupGeoForTrueSolar(location.city) != null)

  if (useTrueSolar && location) {
    const geo = lookupGeoForTrueSolar(location.city)!
    const corrected = toSolarTime(hour, minute, geo.lon, geo.tz)
    hour = corrected.hour
    minute = corrected.minute
  }

  const date = new Date(year, month - 1, day, hour, minute, 0)
  const lunar =
    typeof (Lunar as any)?.fromDate === 'function'
      ? (Lunar as any).fromDate(date)
      : Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar()

  const eightChar = lunar.getEightChar()
  return {
    lunar,
    eightChar,
    usedTrueSolar: useTrueSolar,
    gregorian: { year, month, day, hour, minute },
  }
}

export function calcBazi(
  birth: BirthDateInput,
  calendarType: '公历' | '农历' = '公历',
  location?: BaziLocationArg,
): Omit<BaziResult, 'chengGu'> {
  const { eightChar } = computeBaziContext(birth, calendarType, location)
  const yearName = eightChar.getYear?.() ?? ''
  const monthName = eightChar.getMonth?.() ?? ''
  const dayName = eightChar.getDay?.() ?? ''
  const hourName = eightChar.getTime?.() ?? ''

  const yearParsed = parseStemBranch(yearName)
  const monthParsed = parseStemBranch(monthName)
  const dayParsed = parseStemBranch(dayName)
  const hourParsed = parseStemBranch(hourName)

  const weightedCounts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } as Record<'木' | '火' | '土' | '金' | '水', number>

  const addStem = (stem?: string) => {
    if (!stem) return
    const el = stemElement[stem]
    if (el) weightedCounts[el] += 5
  }

  const addBranch = (branch?: string, isMonthBranch = false) => {
    if (!branch) return
    const hidden = branchHidden[branch] ?? []
    for (const { stem, weight } of hidden) {
      const el = stemElement[stem]
      if (!el) continue
      const isMainStem = hidden[0].stem === stem
      const multiplier = isMonthBranch && isMainStem ? 2 : 1
      weightedCounts[el] += weight * multiplier
    }
  }

  addStem(yearParsed.stem)
  addBranch(yearParsed.branch)
  addStem(monthParsed.stem)
  addBranch(monthParsed.branch, true)
  addStem(dayParsed.stem)
  addBranch(dayParsed.branch)
  addStem(hourParsed.stem)
  addBranch(hourParsed.branch)

  const allBranches = [yearParsed.branch, monthParsed.branch, dayParsed.branch, hourParsed.branch].filter(
    Boolean,
  ) as string[]

  for (const combo of [...threeHarmony, ...threeDirection]) {
    if (combo.branches.every((b) => allBranches.includes(b))) {
      weightedCounts[combo.element] += combo.bonus
    }
  }

  const total = Math.max(1, Object.values(weightedCounts).reduce((a, b) => a + b, 0))
  const elements = (['木', '火', '土', '金', '水'] as const).map((el) => ({
    element: el,
    count: weightedCounts[el],
    percent: Math.round((weightedCounts[el] / total) * 1000) / 10,
  }))

  const sorted = [...elements].sort((a, b) => b.count - a.count)
  const top = sorted[0]!
  const second = sorted[1]!

  const summary = `四柱：${yearName} / ${monthName} / ${dayName} / ${hourName}。主导五行偏${top.element}（${top.percent}%），其次为${second.element}（${second.percent}%）。`

  const dayMaster = parseDayMasterFromDayPillar(dayName)

  return {
    pillars: { year: yearName, month: monthName, day: dayName, hour: hourName },
    elements,
    summary,
    dayMaster,
  }
}
