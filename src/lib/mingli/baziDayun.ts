/**
 * 八字大运：与通书常见法一致
 * - 阳男阴女顺排，阴男阳女逆排（与 lunar-javascript 内 getYun 一致）
 * - 大运干支以**月柱**（与排盘表 `getMonth()` 一致）为起点，每步顺/逆一位，十年一运
 * - 起运岁数与每运起止年份取自 lunar `EightChar.getYun`（节气法 sect=1），保证与「出生后 X 年 Y 月 Z 日起运」对齐
 */
import { Solar } from 'lunar-javascript'
import type { Gender } from '../types'
import type { BaziLunarContext } from './bazi'

const GAN = '甲乙丙丁戊己庚辛壬癸'
const ZHI = '子丑寅卯辰巳午未申酉戌亥'

function jiaZiFromIndex(k: number): string {
  const n = ((k % 60) + 60) % 60
  return GAN[n % 10] + ZHI[n % 12]
}

/** 六十甲子序号 0..59，非法组合返回 -1 */
export function jiaZiIndex(gz: string): number {
  if (!gz || gz.length < 2) return -1
  const g = GAN.indexOf(gz[0]!)
  const z = ZHI.indexOf(gz[1]!)
  if (g < 0 || z < 0) return -1
  for (let k = 0; k < 60; k++) {
    if (k % 10 === g && k % 12 === z) return k
  }
  return -1
}

/** 阳年：天干为甲丙戊庚壬 */
function isYangYear(yearGan: string): boolean {
  return '甲丙戊庚壬'.includes(yearGan)
}

/** 与 lunar getYun 内 forward 定义一致 */
export function dayunForward(yearGan: string, gender: Gender): boolean {
  const yang = isYangYear(yearGan)
  const man = gender === '男'
  return (yang && man) || (!yang && !man)
}

/** 第 n 步大运（n=1 为第一步大运），相对月柱顺逆各走一步 */
export function dayunGanZhiForStep(monthGanZhi: string, forward: boolean, step: number): string {
  const base = jiaZiIndex(monthGanZhi)
  if (base < 0) return ''
  const delta = forward ? step : -step
  return jiaZiFromIndex(base + delta)
}

export type BaziDayunRow = {
  /** 第几步大运，1 起 */
  step: number
  ganZhi: string
  startYear: number
  endYear: number
  /** 虚岁区间（与 lunar 大运一致） */
  startAge: number
  endAge: number
}

/** 童限（未交大运），柱位展示为「小运」 */
export type BaziDayunTongPeriod = {
  startYear: number
  endYear: number
  startAge: number
  endAge: number
}

export type BaziLiuNianColumn = {
  year: number
  /** 虚岁 */
  age: number
  ganZhi: string
}

export type BaziDayunBundle = {
  /** 是否顺排 */
  isForward: boolean
  /** 出生后起运说明 */
  qiYunText: string
  /** 公历起运日期（YYYY-MM-DD） */
  qiYunSolarYmd: string
  /** 童限：出生年至交大运前一年 */
  tong: BaziDayunTongPeriod | null
  /** 各步大运 */
  rows: BaziDayunRow[]
  /** 流年横排：以排盘日为中心前后各若干年（界面展示以当前年重算） */
  liuNianFlow: BaziLiuNianColumn[]
}

/** 按立春换年取流年干支 */
export function buildLiuNianFlow(
  birthYear: number,
  centerYear: number,
  before = 5,
  after = 5,
): BaziLiuNianColumn[] {
  const out: BaziLiuNianColumn[] = []
  for (let y = centerYear - before; y <= centerYear + after; y++) {
    const lunar = Solar.fromYmd(y, 7, 1).getLunar()
    const gz =
      typeof lunar.getYearInGanZhiByLiChun === 'function'
        ? lunar.getYearInGanZhiByLiChun()
        : lunar.getYearInGanZhi()
    const age = y - birthYear + 1
    out.push({ year: y, age: Math.max(1, age), ganZhi: gz })
  }
  return out
}

/**
 * @param sect 1=三天折一年等节气法（默认）；2=按分钟精确（与 lunar 一致）
 */
export function computeBaziDaYun(ctx: BaziLunarContext, gender: Gender, sect: 1 | 2 = 1): BaziDayunBundle | null {
  const ec = ctx.eightChar as {
    getYear: () => string
    getMonth: () => string
    getYun: (g: number, s?: number) => {
      isForward: () => boolean
      getStartYear: () => number
      getStartMonth: () => number
      getStartDay: () => number
      getStartHour: () => number
      getStartSolar: () => { toYmd: () => string }
      getDaYun: (n?: number) => {
        getStartYear: () => number
        getEndYear: () => number
        getGanZhi: () => string
        getIndex: () => number
        getStartAge: () => number
        getEndAge: () => number
      }[]
    }
  }

  if (typeof ec.getYun !== 'function') return null

  const yearGz = ec.getYear()
  const yearGan = yearGz[0] ?? ''
  const monthGz = ec.getMonth()

  const genderCode = gender === '男' ? 1 : 0
  let yun: ReturnType<typeof ec.getYun>
  try {
    yun = ec.getYun(genderCode, sect)
  } catch {
    return null
  }

  const forward = dayunForward(yearGan, gender)
  const useForward = forward

  const sy = yun.getStartYear()
  const sm = yun.getStartMonth()
  const sd = yun.getStartDay()
  const sh = yun.getStartHour()
  const qiYunSolarYmd = yun.getStartSolar().toYmd()
  const qiYunText = `出生后 ${sy} 年 ${sm} 月 ${sd} 天${sh ? ` ${sh} 小时` : ''} 交大运；公历起运约 ${qiYunSolarYmd}`

  const daList = yun.getDaYun(14)
  const d0 = daList[0]!
  let tong: BaziDayunTongPeriod | null = null
  if (d0 && typeof d0.getStartYear === 'function') {
    const sy = d0.getStartYear()
    const ey = d0.getEndYear()
    if (ey >= sy) {
      tong = {
        startYear: sy,
        endYear: ey,
        startAge: d0.getStartAge(),
        endAge: d0.getEndAge(),
      }
    }
  }

  const birthYear = ctx.gregorian.year
  const rows: BaziDayunRow[] = []

  for (let i = 1; i < daList.length; i++) {
    const d = daList[i]!
    const step = i
    const gzCalc = dayunGanZhiForStep(monthGz, useForward, step)
    const gzLib = d.getGanZhi()
    rows.push({
      step,
      ganZhi: gzCalc || gzLib,
      startYear: d.getStartYear(),
      endYear: d.getEndYear(),
      startAge: d.getStartAge(),
      endAge: d.getEndAge(),
    })
  }

  const liuNianFlow = buildLiuNianFlow(birthYear, new Date().getFullYear(), 5, 5)

  return {
    isForward: useForward,
    qiYunText,
    qiYunSolarYmd,
    tong,
    rows,
    liuNianFlow,
  }
}
