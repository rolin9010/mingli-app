/**
 * 袁天罡称骨（民间流传表）：年干支 + 农历月 + 农历日 + 时辰 → 总钱数，再换「两」「钱」与歌诀。
 * 不同流派表文略有出入，此处采用常见网络通表；仅供文化展示。
 */

/** 六十甲子 · 年柱重量（钱，1两=10钱） */
const YEAR_QIAN: Record<string, number> = {
  甲子: 12,
  乙丑: 9,
  丙寅: 6,
  丁卯: 7,
  戊辰: 12,
  己巳: 5,
  庚午: 9,
  辛未: 8,
  壬申: 7,
  癸酉: 8,
  甲戌: 15,
  乙亥: 9,
  丙子: 16,
  丁丑: 8,
  戊寅: 8,
  己卯: 19,
  庚辰: 12,
  辛巳: 6,
  壬午: 8,
  癸未: 7,
  甲申: 5,
  乙酉: 15,
  丙戌: 6,
  丁亥: 16,
  戊子: 15,
  己丑: 7,
  庚寅: 9,
  辛卯: 12,
  壬辰: 10,
  癸巳: 7,
  甲午: 15,
  乙未: 6,
  丙申: 5,
  丁酉: 14,
  戊戌: 14,
  己亥: 9,
  庚子: 7,
  辛丑: 7,
  壬寅: 9,
  癸卯: 12,
  甲辰: 8,
  乙巳: 7,
  丙午: 13,
  丁未: 5,
  戊申: 14,
  己酉: 5,
  庚戌: 9,
  辛亥: 17,
  壬子: 5,
  癸丑: 7,
  甲寅: 12,
  乙卯: 8,
  丙辰: 8,
  丁巳: 6,
  戊午: 19,
  己未: 6,
  庚申: 8,
  辛酉: 16,
  壬戌: 10,
  癸亥: 6,
}

/** 农历正月～腊月（钱） */
const MONTH_QIAN = [6, 7, 18, 9, 5, 16, 9, 15, 18, 8, 9, 5]

/**
 * 农历初一～三十（钱）—— 通表之一；与部分通书可能略有差异。
 * 索引 0 占位，1=初一 … 30=三十
 */
const LUNAR_DAY_QIAN: number[] = [
  0, 5, 10, 8, 15, 16, 15, 8, 16, 8, 16, 8, 16, 8, 17, 10, 8, 9, 18, 5, 15, 15, 9, 8, 9, 15, 18, 7, 8, 16, 6,
]

/** 十二时辰 · 时柱地支（钱） */
const BRANCH_HOUR_QIAN: Record<string, number> = {
  子: 16,
  丑: 6,
  寅: 7,
  卯: 10,
  辰: 9,
  巳: 16,
  午: 5,
  未: 7,
  申: 8,
  酉: 9,
  戌: 6,
  亥: 6,
}

export type ChengGuResult = {
  /** 总钱数 */
  totalQian: number
  /** 展示：如「4两2钱」 */
  weightLabel: string
  /** 歌诀标题（骨重档位） */
  title: string
  /** 袁天罡称骨歌（节选/意译） */
  poem: string
  /** 白话提要 */
  summary: string
}

function parseBranch(ganzhi: string): string | undefined {
  return ganzhi.match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]
}

function formatWeightLabel(totalQian: number): string {
  const liang = Math.floor(totalQian / 10)
  const qian = totalQian % 10
  if (qian === 0) return `${liang}两`
  return `${liang}两${qian}钱`
}

/** 按总钱数取歌诀（合并相近档位，避免缺条） */
function verseFor(totalQian: number): { title: string; poem: string; summary: string } {
  const t = totalQian / 10
  if (t < 2.5) {
    return {
      title: '二两上下',
      poem: '身寒骨冷苦伶仃，此命推来行乞人；劳劳碌碌无度日，终年打拱过平生。',
      summary: '表多早年奔波、宜后天勤勉与积德改运；仅供参考，勿以宿命自限。',
    }
  }
  if (t < 3.5) {
    return {
      title: '三两前后',
      poem: '劳劳碌碌苦中求，东奔西走何日休；若使终身勤与俭，老来稍可免忧愁。',
      summary: '主辛劳自立，中年后渐稳；宜专精一技、量入为出。',
    }
  }
  if (t < 4.5) {
    return {
      title: '四两前后',
      poem: '平生衣禄是绵绵。此命生来福气多，衣食丰足福寿长；一生安稳少波折，晚年富贵享荣华。',
      summary: '衣食丰足、心性自守之象；宜守正持恒，晚景多安。',
    }
  }
  if (t < 5.5) {
    return {
      title: '五两前后',
      poem: '为利为名终日劳，中年福禄也多遭；老来似有财星照，不比前番目下高。',
      summary: '中岁有成，晚年更宜收敛锋芒、颐养天年。',
    }
  }
  if (t < 6.5) {
    return {
      title: '六两前后',
      poem: '一朝金榜快题名，显祖荣宗立大功；衣食定然原裕足，田园财帛更丰盈。',
      summary: '贵显福禄之格，宜读书进取、广结善缘；仍须脚踏实地。',
    }
  }
  return {
    title: '七两上下',
    poem: '此命推来福禄宏，不须劳碌过平生；一生自有天相护，晚景荣华享太平。',
    summary: '福泽深厚之象；仍戒骄奢，以德配位。',
  }
}

export function calcChengGu(lunar: {
  getMonth: () => number
  getDay: () => number
}, eightChar: { getYear: () => string; getTime: () => string }): ChengGuResult {
  const y = YEAR_QIAN[eightChar.getYear()] ?? 0
  let month = lunar.getMonth()
  if (month < 0) month = Math.abs(month)
  const m = MONTH_QIAN[Math.min(12, Math.max(1, month)) - 1] ?? 0
  const dayNum = Math.min(30, Math.max(1, lunar.getDay()))
  const d = LUNAR_DAY_QIAN[dayNum] ?? 0
  const br = parseBranch(eightChar.getTime())
  const h = br ? (BRANCH_HOUR_QIAN[br] ?? 0) : 0
  const totalQian = y + m + d + h
  const weightLabel = formatWeightLabel(totalQian)
  const v = verseFor(totalQian)
  return {
    totalQian,
    weightLabel,
    title: v.title,
    poem: v.poem,
    summary: v.summary,
  }
}
