import type { BaziDayunBundle } from './mingli/baziDayun'
import type { ChengGuResult } from './mingli/chengGu'
import type { DayMasterInfo } from './mingli/dayMaster'
import type { AstroResult } from './mingli/astro'
import type { HumanDesignResult } from './mingli/humanDesign'
import type { ZiweiResult } from './mingli/ziwei'

export type Gender = '男' | '女'
export type BloodType = 'A' | 'B' | 'O' | 'AB'

export type MBTI =
| 'INTJ' | 'INFJ' | 'ISTJ' | 'ISFJ'
| 'INFP' | 'INTP' | 'ENTJ' | 'ENFJ'
| 'ENTP' | 'ENFP' | 'ISTP' | 'ISFP'
| 'ESTP' | 'ESFP' | 'ESTJ' | 'ESFJ'

export type BirthDateInput = {
year: number
month: number
day: number
hour: number
minute?: number
}

export type UserInput = {
name: string
birth: BirthDateInput
gender: Gender
bloodType?: BloodType
mbti?: MBTI
mbtiDimensions?: {
ei: 'I' | 'E'
sn: 'S' | 'N'
tf: 'T' | 'F'
jp: 'J' | 'P'
}
calendarType?: '公历' | '农历'
country?: string
province?: string
city?: string
district?: string
saveData?: boolean
useSolarTime?: boolean
/**
 * 第一步勾选的排盘体系（8 项），与第二步展示卡片对应；未传时第二步使用内置默认。
 */
selectedChartSystems?: string[]
}

export type LifeNumberResult = {
number: number
title: string
interpretation: string
}

export type SolarSignResult = {
sign: string
range: string
traits: string
}

export type BloodTypeResult = {
bloodType: BloodType
title: string
interpretation: string
}

export type MbtiResult = {
mbti: MBTI
province?: string
city?: string
title: string
interpretation: string
}

export type BaziResult = {
pillars: {
year: string
month: string
day: string
hour: string
}
elements: {
element: '木' | '火' | '土' | '金' | '水'
count: number
/** 占比（可保留一位小数，与通书展示一致） */
percent: number
}[]
summary: string
/** 日主：日干五行与简要意象 */
dayMaster: DayMasterInfo | null
/** 袁天罡称骨（农历年/月/日 + 时辰） */
chengGu: ChengGuResult
/** 大运（节气起运 + 月柱顺逆十年一步） */
dayun?: BaziDayunBundle | null
}

export type TarotCard = {
id: number
name: string
keywords: string[]
meaningUpright: string
}

export type TarotResult = {
picks: {
position: '过去' | '现在' | '未来'
card: TarotCard
}[]
}

export type { AstroPlanet, AstroResult } from './mingli/astro'
export type { BaziDayunBundle } from './mingli/baziDayun'
export type { HumanDesignResult }
export type { ZiweiResult }

export type ReportResults = {
lifeNumber: LifeNumberResult
solar: SolarSignResult
blood: BloodTypeResult
mbti: MbtiResult
bazi: BaziResult
tarot: TarotResult
astro: AstroResult
humanDesign: HumanDesignResult
ziwei?: ZiweiResult
}
