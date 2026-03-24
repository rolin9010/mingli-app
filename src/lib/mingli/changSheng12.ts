/**
 * 十二长生（与 lunar-javascript EightChar._getDiShi 同算法：阳干顺行、阴干逆行）。
 * - 星运：以日干查各柱地支
 * - 自坐：以本柱天干查本柱地支
 */

const ZHI_ORDER = '子丑寅卯辰巳午未申酉戌亥'

const STEM_ORDER = '甲乙丙丁戊己庚辛壬癸'

/** 与 LunarUtil.CHANG_SHENG_OFFSET 数值一致 */
const CHANG_SHENG_OFFSET: Record<string, number> = {
  甲: 1,
  乙: 6,
  丙: 10,
  丁: 9,
  戊: 10,
  己: 9,
  庚: 7,
  辛: 0,
  壬: 4,
  癸: 3,
}

export const TWELVE_STAGES = [
  '长生',
  '沐浴',
  '冠带',
  '临官',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '绝',
  '胎',
  '养',
] as const

function stemIsYang(stem: string): boolean {
  const i = STEM_ORDER.indexOf(stem)
  return i >= 0 && i % 2 === 0
}

/**
 * 返回该「天干」在「地支」上所落的十二长生名；无效输入返回「—」
 */
export function twelveStageForStemOnBranch(stem: string, branch: string): string {
  const offset = CHANG_SHENG_OFFSET[stem]
  const zhiIdx = ZHI_ORDER.indexOf(branch)
  if (offset === undefined || zhiIdx < 0) return '—'
  const yang = stemIsYang(stem)
  let idx = offset + (yang ? zhiIdx : -zhiIdx)
  idx = ((idx % 12) + 12) % 12
  return TWELVE_STAGES[idx] ?? '—'
}
