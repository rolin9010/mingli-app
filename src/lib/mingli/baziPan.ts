import type { Gender } from '../types'
import type { BaziLunarContext } from './bazi'
import { twelveStageForStemOnBranch } from './changSheng12'
import { computeShenShaForPillars } from './shenSha'

/** 将 lunar-javascript 返回的藏干/十神列表统一成 string[] */
function toStrList(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  return String(v)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export type BaziPanColumn = {
  pillarLabel: string
  ganZhi: string
  stem: string
  branch: string
  /** 主星（天干十神）；日柱为 元男/元女 */
  mainGod: string
  /** 藏干 + 副星（地支藏干对应十神） */
  hidden: { stem: string; god: string }[]
  naYin: string
  xunKong: string
  /** 神煞：按日干、日支三合、年支等规则推算 */
  shenSha: string[]
  /** 星运：日干论该柱地支的十二长生 */
  xingYun: string
  /** 自坐：本柱天干论本柱地支的十二长生 */
  ziZuo: string
}

export type BaziPanModel = {
  title: string
  gender: Gender
  solarLine: string
  lunarLine: string
  usedTrueSolar: boolean
  columns: BaziPanColumn[]
}

function splitGanZhi(gz: string): { stem: string; branch: string } {
  const stem = gz.match(/[甲乙丙丁戊己庚辛壬癸]/)?.[0] ?? ''
  const branch = gz.match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0] ?? ''
  return { stem, branch }
}

/** lunar-javascript EightChar：动态方法名取藏干与十神 */
type EightCharLike = Record<string, (() => unknown) | undefined>

function buildHidden(ec: EightCharLike, hideKey: string, godKey: string): { stem: string; god: string }[] {
  const stems = toStrList(ec[hideKey]?.())
  const gods = toStrList(ec[godKey]?.())
  const n = Math.max(stems.length, gods.length)
  const out: { stem: string; god: string }[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      stem: stems[i] ?? '',
      god: gods[i] ?? '',
    })
  }
  return out.filter((x) => x.stem || x.god)
}

export function buildBaziPanModel(
  ctx: BaziLunarContext,
  name: string,
  gender: Gender,
): BaziPanModel {
  const { lunar, eightChar: ec, usedTrueSolar, gregorian } = ctx
  const g = gregorian
  const solarLine = `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')} ${String(g.hour).padStart(2, '0')}:${String(g.minute).padStart(2, '0')}`

  const lunarLine = `${lunar.getYearInChinese()}年 ${lunar.getMonthInChinese()}${lunar.getDayInChinese()}`

  const dayMasterLabel = gender === '女' ? '元女' : '元男'

  const gzYear = ec.getYear()
  const gzMonth = ec.getMonth()
  const gzDay = ec.getDay()
  const gzTime = ec.getTime()

  const mainGods = [
    ec.getYearShiShenGan(),
    ec.getMonthShiShenGan(),
    dayMasterLabel,
    ec.getTimeShiShenGan(),
  ]

  const configs: { label: string; gz: string; hide: string; godZhi: string; naYin: string; xunKong: string }[] = [
    { label: '年柱', gz: gzYear, hide: 'getYearHideGan', godZhi: 'getYearShiShenZhi', naYin: ec.getYearNaYin(), xunKong: ec.getYearXunKong() },
    { label: '月柱', gz: gzMonth, hide: 'getMonthHideGan', godZhi: 'getMonthShiShenZhi', naYin: ec.getMonthNaYin(), xunKong: ec.getMonthXunKong() },
    { label: '日柱', gz: gzDay, hide: 'getDayHideGan', godZhi: 'getDayShiShenZhi', naYin: ec.getDayNaYin(), xunKong: ec.getDayXunKong() },
    { label: '时柱', gz: gzTime, hide: 'getTimeHideGan', godZhi: 'getTimeShiShenZhi', naYin: ec.getTimeNaYin(), xunKong: ec.getTimeXunKong() },
  ]

  const pillarsForShen = {
    year: splitGanZhi(gzYear),
    month: splitGanZhi(gzMonth),
    day: splitGanZhi(gzDay),
    time: splitGanZhi(gzTime),
  }
  const [shenYear, shenMonth, shenDay, shenTime] = computeShenShaForPillars(pillarsForShen, {
    xunKongPerPillar: configs.map((c) => c.xunKong),
    dayXunKong: ec.getDayXunKong(),
  })
  const shenByCol = [shenYear, shenMonth, shenDay, shenTime]

  const dayStem = splitGanZhi(gzDay).stem

  const columns: BaziPanColumn[] = configs.map((row, idx) => {
    const { stem, branch } = splitGanZhi(row.gz)
    const hidden = buildHidden(ec, row.hide, row.godZhi)
    const xingYun =
      dayStem && branch ? twelveStageForStemOnBranch(dayStem, branch) : '—'
    const ziZuo = stem && branch ? twelveStageForStemOnBranch(stem, branch) : '—'
    return {
      pillarLabel: row.label,
      ganZhi: row.gz,
      stem,
      branch,
      mainGod: String(mainGods[idx] ?? ''),
      hidden,
      naYin: row.naYin,
      xunKong: row.xunKong,
      shenSha: shenByCol[idx] ?? [],
      xingYun,
      ziZuo,
    }
  })

  return {
    title: `${name || '未命名'}八字排盘`,
    gender,
    solarLine,
    lunarLine,
    usedTrueSolar,
    columns,
  }
}
