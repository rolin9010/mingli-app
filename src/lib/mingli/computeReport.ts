import { Lunar } from 'lunar-javascript'
import type { BirthDateInput, ReportResults, UserInput } from '../types'
import { lookupGeo } from '../geo'
import { calcLifeNumber } from './numerology'
import { calcSolarSign } from './solar'
import { calcBloodType } from './blood'
import { calcMbti } from './mbti'
import { calcBazi, computeBaziContext } from './bazi'
import { calcChengGu } from './chengGu'
import { computeBaziDaYun } from './baziDayun'
import { calcTarot } from './tarot'
import { calcZiwei } from './ziwei'
import { calcAstro } from './astro'
import { calcHumanDesignFromWallClock } from './humanDesign'

/** 西洋占星必须用出生地墙钟时间，不得使用八字用的真太阳时校正。 */
function gregorianWallClockForWestern(
  birth: BirthDateInput,
  calendarType?: '公历' | '农历',
): { year: number; month: number; day: number; hour: number; minute: number } {
  let { year, month, day, hour, minute = 0 } = birth
  if (calendarType === '农历') {
    const solar = Lunar.fromYmd(year, month, day).getSolar()
    year = solar.getYear()
    month = solar.getMonth()
    day = solar.getDay()
  }
  return { year, month, day, hour, minute }
}

function baziLocationFromInput(input: UserInput) {
  return {
    country: input.country,
    province: input.province,
    city: input.city,
    district: input.district,
    useSolarTime: input.useSolarTime,
  }
}

export function computeAll(input: UserInput): ReportResults {
  const lifeNumber = calcLifeNumber(input.birth)
  const blood = calcBloodType(input.bloodType ?? 'O')
  const mbti = calcMbti(input.mbti ?? 'INTJ')
  const baziLoc = baziLocationFromInput(input)
  const baziCtx = computeBaziContext(input.birth, input.calendarType ?? '公历', baziLoc)
  const baziBase = calcBazi(input.birth, input.calendarType, baziLoc)
  const chengGu = calcChengGu(baziCtx.lunar, baziCtx.eightChar)
  const dayunBundle = computeBaziDaYun(baziCtx, input.gender)
  const bazi = { ...baziBase, chengGu, dayun: dayunBundle ?? undefined }

  const tarot = calcTarot(
    input.birth,
    // seedExtra 用名字+性别做一点扰动：同生日不同用户也能得到不同抽牌
    `${input.name}|${input.gender}`,
  )

  const { hour: solarHour, minute: solarMinute } = baziCtx.gregorian
  const ziwei = calcZiwei(
    // Ziwei：若用户输入为「农历」，则必须按农历排；否则按公历排。
    // 注意：baziCtx.gregorian 的 year/month/day 在「农历」模式下会被换算成阳历，
    // 因此这里必须使用用户输入的 year/month/day 作为 ziwei 的日期参数。
    input.birth.year,
    input.birth.month,
    input.birth.day,
    solarHour,
    input.gender,
    input.calendarType === '农历',
    solarMinute,
  )

  const geo = lookupGeo(input.country, input.city)
  const westernGreg = gregorianWallClockForWestern(input.birth, input.calendarType)
  const solar = calcSolarSign({
    year: westernGreg.year,
    month: westernGreg.month,
    day: westernGreg.day,
    hour: westernGreg.hour,
    minute: westernGreg.minute,
  })
  const tz = geo?.tz ?? 8
  const astro = calcAstro(
    {
      year: westernGreg.year,
      month: westernGreg.month,
      day: westernGreg.day,
      hour: westernGreg.hour,
      minute: westernGreg.minute,
    },
    geo ? { lat: geo.lat, lon: geo.lon, tz: geo.tz } : null,
  )

  const humanDesign = calcHumanDesignFromWallClock(
    {
      year: westernGreg.year,
      month: westernGreg.month,
      day: westernGreg.day,
      hour: westernGreg.hour,
      minute: westernGreg.minute,
    },
    tz,
  )

  return { lifeNumber, solar, blood, mbti, bazi, tarot, astro, humanDesign, ziwei }
}

