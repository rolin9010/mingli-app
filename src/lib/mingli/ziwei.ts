import { astro, util } from 'iztro'
import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe'
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace'
import type { IFunctionalStar } from 'iztro/lib/star/FunctionalStar'

/** 单颗星展示（庙旺、四化） */
export interface ZiweiStarDisp {
  name: string
  brightness?: string
  mutagen?: string
}

/** 单宫结构化数据（与命盘网格对应） */
export interface ZiweiPalaceCellData {
  index: number
  name: string
  heavenlyStem: string
  earthlyBranch: string
  majorStars: ZiweiStarDisp[]
  minorStars: ZiweiStarDisp[]
  /** 杂曜等，已压平为名称 */
  adjectiveStars: string[]
  changsheng12: string
  boshi12: string
  decadalRange: [number, number]
  /** 小限年龄摘取展示 */
  agesShort: string
  isBodyPalace: boolean
}

export interface ZiweiResult {
  mainStar: string
  bodyStar: string
  lifepalace: string
  summary: string
  /** 农历日期，如「一九九〇年八月廿八」 */
  lunarDate: string
  /** 简表：供 AI / 兼容旧逻辑 */
  palaces: Array<{
    name: string
    stars: string[]
  }>
  header: {
    solarDate: string
    lunarDate: string
    time: string
    timeRange: string
    /** 命主（iztro soul） */
    soul: string
    /** 身主（iztro body） */
    body: string
    zodiac: string
    sign: string
    fiveElementsClass: string
    /** 干支历摘要（四柱等） */
    chineseDate: string
  }
  palaceCells: ZiweiPalaceCellData[]
  /** 以「当前日期」取的运限快照；失败时为 null */
  horoscope: {
    targetSolarDate: string
    nominalAge: number
    decadalStem: string
    yearlyStem: string
    monthlyStem: string
    dailyStem: string
    hourlyStem: string
    decadalIndex: number
    yearlyIndex: number
    monthlyIndex: number
  } | null
  /** 命宫三方四正宫位索引（用于高亮） */
  mingSurroundPalaceIndices: number[]
}

function hourToTimeIndex(hour: number, minute = 0): number {
  const h = hour + minute / 60
  const ih = Math.min(23, Math.max(0, Math.floor(h)))
  return util.timeToIndex(ih)
}

function toStarDisp(s: IFunctionalStar): ZiweiStarDisp {
  const brightness = s.brightness != null && s.brightness !== '' ? String(s.brightness) : undefined
  const mutRaw = s.mutagen
  const mutagen =
    mutRaw != null && String(mutRaw).trim() !== '' ? String(mutRaw) : undefined
  return {
    name: s.name,
    ...(brightness ? { brightness } : {}),
    ...(mutagen ? { mutagen } : {}),
  }
}

function buildPalaceCell(p: IFunctionalPalace): ZiweiPalaceCellData {
  const decadal = p.decadal
  const range: [number, number] =
    decadal && Array.isArray(decadal.range) && decadal.range.length >= 2
      ? [Number(decadal.range[0]), Number(decadal.range[1])]
      : [0, 0]

  const ages = Array.isArray(p.ages) ? p.ages : []
  const agesShort = ages.length > 0 ? ages.slice(0, 5).join('、') : '—'

  const majorStars = (p.majorStars ?? []).filter((s) => s.name).map(toStarDisp)
  const minorStars = (p.minorStars ?? []).filter((s) => s.name).map(toStarDisp)
  const adjectiveStars = (p.adjectiveStars ?? [])
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 12)

  return {
    index: p.index,
    name: p.name,
    heavenlyStem: String(p.heavenlyStem ?? ''),
    earthlyBranch: String(p.earthlyBranch ?? ''),
    majorStars,
    minorStars,
    adjectiveStars,
    changsheng12: String(p.changsheng12 ?? ''),
    boshi12: String(p.boshi12 ?? ''),
    decadalRange: range,
    agesShort,
    isBodyPalace: Boolean(p.isBodyPalace),
  }
}

function emptyZiwei(msg: string): ZiweiResult {
  return {
    mainStar: '计算失败',
    bodyStar: '-',
    lifepalace: '-',
    summary: msg,
    lunarDate: '',
    palaces: [],
    header: {
      solarDate: '—',
      lunarDate: '—',
      time: '—',
      timeRange: '—',
      soul: '—',
      body: '—',
      zodiac: '—',
      sign: '—',
      fiveElementsClass: '—',
      chineseDate: '—',
    },
    palaceCells: [],
    horoscope: null,
    mingSurroundPalaceIndices: [],
  }
}

export function calcZiwei(
  year: number,
  month: number,
  day: number,
  hour: number,
  gender: '男' | '女',
  isLunar = false,
  minute = 0,
): ZiweiResult {
  try {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const timeIndex = hourToTimeIndex(hour, minute)
    const genderName = gender === '男' ? '男' : '女'

    const chart: IFunctionalAstrolabe = isLunar
      ? astro.byLunar(dateStr, timeIndex, genderName, false, true, 'zh-CN')
      : astro.bySolar(dateStr, timeIndex, genderName, true, 'zh-CN')

    const lifePalace = chart.palace('命宫')
    const bodyPalace = chart.palaces.find((p) => p.isBodyPalace) ?? chart.palace('身宫')

    const lifeMainStars =
      chart.palaces
        .find((p) => p.name === '命宫')
        ?.majorStars?.filter((s) => s.type === 'major' && String(s.name).trim() !== '')
        ?.map((s) => s.name) ?? []

    let mainStar = lifeMainStars.join('、')
    if (!mainStar) {
      const opposingStars =
        chart.palaces
          .find((p) => p.name === '疾厄')
          ?.majorStars?.filter((s) => s.type === 'major')
          ?.map((s) => s.name)
          ?.join('、') ?? ''
      mainStar = opposingStars ? `空宫（借疾厄：${opposingStars}）` : '空宫'
    }

    const bodyStar =
      bodyPalace?.majorStars
        .filter((s) => s.type === 'major')
        .map((s) => s.name)
        .join('、') || '无'

    const palaces = chart.palaces.map((p) => ({
      name: p.name,
      stars: [...(p.majorStars ?? []), ...(p.minorStars ?? []), ...(p.adjectiveStars ?? [])]
        .map((s) => s.name)
        .filter(Boolean)
        .slice(0, 16),
    }))

    const summary = `命宫主星${mainStar}，身宫落${bodyPalace?.name ?? '未知'}宫`

    const lunarDate =
      (typeof chart.lunarDate === 'string' && chart.lunarDate) ||
      (typeof chart.solarDate === 'string' && chart.solarDate) ||
      ''

    const palaceCells = chart.palaces.map((p) => buildPalaceCell(p))

    let horoscope: ZiweiResult['horoscope'] = null
    try {
      const hp = chart.horoscope()
      horoscope = {
        targetSolarDate: String(hp.solarDate ?? ''),
        nominalAge: Number(hp.age?.nominalAge ?? 0),
        decadalStem: String(hp.decadal?.heavenlyStem ?? ''),
        yearlyStem: String(hp.yearly?.heavenlyStem ?? ''),
        monthlyStem: String(hp.monthly?.heavenlyStem ?? ''),
        dailyStem: String(hp.daily?.heavenlyStem ?? ''),
        hourlyStem: String(hp.hourly?.heavenlyStem ?? ''),
        decadalIndex: Number(hp.decadal?.index ?? -1),
        yearlyIndex: Number(hp.yearly?.index ?? -1),
        monthlyIndex: Number(hp.monthly?.index ?? -1),
      }
    } catch {
      horoscope = null
    }

    let mingSurroundPalaceIndices: number[] = []
    try {
      const sfp = chart.surroundedPalaces('命宫')
      if (sfp) {
        mingSurroundPalaceIndices = [sfp.target, sfp.opposite, sfp.wealth, sfp.career]
          .map((x) => x?.index)
          .filter((i): i is number => typeof i === 'number')
      }
    } catch {
      mingSurroundPalaceIndices = []
    }

    return {
      mainStar,
      bodyStar,
      lifepalace: lifePalace?.name ?? '未知',
      summary,
      lunarDate,
      palaces,
      header: {
        solarDate: String(chart.solarDate ?? ''),
        lunarDate: String(chart.lunarDate ?? ''),
        time: String(chart.time ?? ''),
        timeRange: String(chart.timeRange ?? ''),
        soul: String(chart.soul ?? ''),
        body: String(chart.body ?? ''),
        zodiac: String(chart.zodiac ?? ''),
        sign: String(chart.sign ?? ''),
        fiveElementsClass: String(chart.fiveElementsClass ?? ''),
        chineseDate: String(chart.chineseDate ?? ''),
      },
      palaceCells,
      horoscope,
      mingSurroundPalaceIndices,
    }
  } catch {
    return emptyZiwei('排盘数据异常，请检查输入')
  }
}
