/**
 * 八字四柱神煞（以日干为主查贵人禄刃，以日支三合查马桃花等；孤辰寡宿以年支）。
 * 流派众多，此处采用网上排盘常见规则，便于与参考界面接近。
 */

export type FourPillars = {
  year: { stem: string; branch: string }
  month: { stem: string; branch: string }
  day: { stem: string; branch: string }
  time: { stem: string; branch: string }
}

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const

type SanHeKey = 'shenZiChen' | 'yinWuXu' | 'siYouChou' | 'haiMaoWei'

function branchIndex(z: string): number {
  const ZHI = '子丑寅卯辰巳午未申酉戌亥'
  const i = ZHI.indexOf(z)
  return i >= 0 ? i : -1
}

/** 地支所属三合局（每个支只归属一局） */
function sanHeOfBranch(z: string): SanHeKey | null {
  const map: Record<string, SanHeKey> = {
    申: 'shenZiChen',
    子: 'shenZiChen',
    辰: 'shenZiChen',
    寅: 'yinWuXu',
    午: 'yinWuXu',
    戌: 'yinWuXu',
    巳: 'siYouChou',
    酉: 'siYouChou',
    丑: 'siYouChou',
    亥: 'haiMaoWei',
    卯: 'haiMaoWei',
    未: 'haiMaoWei',
  }
  return map[z] ?? null
}

const SAN_HE_EXTRAS: Record<
  SanHeKey,
  { jiang: string; yiMa: string; taoHua: string; huaGai: string; jieSha: string; wangShen: string }
> = {
  shenZiChen: { jiang: '子', yiMa: '寅', taoHua: '酉', huaGai: '辰', jieSha: '巳', wangShen: '亥' },
  yinWuXu: { jiang: '午', yiMa: '申', taoHua: '卯', huaGai: '戌', jieSha: '亥', wangShen: '巳' },
  siYouChou: { jiang: '酉', yiMa: '亥', taoHua: '午', huaGai: '丑', jieSha: '寅', wangShen: '申' },
  haiMaoWei: { jiang: '卯', yiMa: '巳', taoHua: '子', huaGai: '未', jieSha: '申', wangShen: '寅' },
}

function tianYiGuiRenForDayStem(gan: string): Set<string> {
  const s = new Set<string>()
  if (!gan) return s
  // 甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎，此是贵人方
  if (gan === '甲' || gan === '戊' || gan === '庚') {
    s.add('丑')
    s.add('未')
  }
  if (gan === '乙' || gan === '己') {
    s.add('子')
    s.add('申')
  }
  if (gan === '丙' || gan === '丁') {
    s.add('亥')
    s.add('酉')
  }
  if (gan === '壬' || gan === '癸') {
    s.add('卯')
    s.add('巳')
  }
  if (gan === '辛') {
    s.add('寅')
    s.add('午')
  }
  return s
}

function taiJiGuiRenForDayStem(gan: string): Set<string> {
  const s = new Set<string>()
  if (!gan) return s
  // 甲乙子午宫，丙丁卯酉中，戊己辰戌丑未，庚辛寅申位，壬癸巳亥中
  // 问真等盘：日干之临官禄位（甲禄寅、乙禄卯）亦入太极贵人，故甲寅日柱可同时见太极与禄神
  if (gan === '甲' || gan === '乙') {
    s.add('子')
    s.add('午')
    if (gan === '甲') s.add('寅')
    if (gan === '乙') s.add('卯')
  }
  if (gan === '丙' || gan === '丁') {
    s.add('卯')
    s.add('酉')
  }
  if (gan === '戊' || gan === '己') {
    ;['辰', '戌', '丑', '未'].forEach((z) => s.add(z))
  }
  if (gan === '庚' || gan === '辛') {
    s.add('寅')
    s.add('申')
  }
  if (gan === '壬' || gan === '癸') {
    s.add('巳')
    s.add('亥')
  }
  return s
}

function wenChangForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '巳',
    乙: '午',
    丙: '申',
    丁: '酉',
    戊: '申',
    己: '酉',
    庚: '亥',
    辛: '子',
    壬: '寅',
    癸: '卯',
  }
  return gan ? m[gan] ?? null : null
}

function fuXingGuiRenForDayStem(gan: string): Set<string> {
  const s = new Set<string>()
  if (!gan) return s
  // 常见：甲丙寅、乙癸卯、戊申、己酉、庚亥、辛子、壬丑
  // 问真等盘：日干甲亦以「午」为福星贵人（与太极/红艳同支时分列，勿合并）
  if (gan === '甲' || gan === '丙') s.add('寅')
  if (gan === '甲') s.add('午')
  if (gan === '乙' || gan === '癸') s.add('卯')
  if (gan === '戊') s.add('申')
  if (gan === '己') s.add('酉')
  if (gan === '庚') s.add('亥')
  if (gan === '辛') s.add('子')
  if (gan === '壬') s.add('丑')
  return s
}

function luZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '巳',
    己: '午',
    庚: '申',
    辛: '酉',
    壬: '亥',
    癸: '子',
  }
  return gan ? m[gan] ?? null : null
}

function yangRenForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '卯',
    丙: '午',
    戊: '午',
    庚: '酉',
    壬: '子',
  }
  return gan ? m[gan] ?? null : null
}

function jinYuForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '辰',
    乙: '巳',
    丙: '未',
    丁: '申',
    戊: '未',
    己: '申',
    庚: '戌',
    辛: '亥',
    壬: '丑',
    癸: '寅',
  }
  return gan ? m[gan] ?? null : null
}

function hongYanForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '午',
    乙: '申',
    丙: '寅',
    丁: '未',
    戊: '辰',
    己: '辰',
    庚: '戌',
    辛: '酉',
    壬: '子',
    癸: '申',
  }
  return gan ? m[gan] ?? null : null
}

/** 月德贵人：见月干为德神（部分流派亦看支，此处标在「天干相合之柱」不直观，改为月柱天干若合则略——简化为仅当月干匹配时给月柱） */
function yueDeGanForMonthBranch(monthZhi: string): string | null {
  const m: Record<string, string> = {
    寅: '丙',
    午: '丙',
    戌: '丙',
    申: '壬',
    子: '壬',
    辰: '壬',
    亥: '甲',
    卯: '甲',
    未: '甲',
    巳: '庚',
    酉: '庚',
    丑: '庚',
  }
  return monthZhi ? m[monthZhi] ?? null : null
}

function guChenForYearBranch(yearZhi: string): string | null {
  const m: Record<string, string> = {
    亥: '寅',
    子: '寅',
    丑: '寅',
    寅: '巳',
    卯: '巳',
    辰: '巳',
    巳: '申',
    午: '申',
    未: '申',
    申: '亥',
    酉: '亥',
    戌: '亥',
  }
  return yearZhi ? m[yearZhi] ?? null : null
}

function guaSuForYearBranch(yearZhi: string): string | null {
  const m: Record<string, string> = {
    亥: '戌',
    子: '戌',
    丑: '戌',
    寅: '丑',
    卯: '丑',
    辰: '丑',
    巳: '辰',
    午: '辰',
    未: '辰',
    申: '未',
    酉: '未',
    戌: '未',
  }
  return yearZhi ? m[yearZhi] ?? null : null
}

/** 国印贵人：日干见支 */
function guoYinZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '戌',
    乙: '亥',
    丙: '丑',
    丁: '寅',
    戊: '丑',
    己: '寅',
    庚: '辰',
    辛: '巳',
    壬: '未',
    癸: '申',
  }
  return gan ? m[gan] ?? null : null
}

/** 学堂（干法）：日干见支 */
function xueTangZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '亥',
    乙: '午',
    丙: '寅',
    丁: '酉',
    戊: '寅',
    己: '酉',
    庚: '巳',
    辛: '子',
    壬: '申',
    癸: '卯',
  }
  return gan ? m[gan] ?? null : null
}

/** 词馆：日干见支 */
function ciGuanZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '申',
    己: '酉',
    庚: '亥',
    辛: '子',
    壬: '寅',
    癸: '卯',
  }
  return gan ? m[gan] ?? null : null
}

/** 流霞：日干见支 */
function liuXiaZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '酉',
    乙: '戌',
    丙: '未',
    丁: '未',
    戊: '申',
    己: '申',
    庚: '酉',
    辛: '戌',
    壬: '亥',
    癸: '丑',
  }
  return gan ? m[gan] ?? null : null
}

/** 月支的前一支为天医所落（与月建逆一位） */
function tianYiZhiForMonthZhi(monthZhi: string): string | null {
  const Z = '子丑寅卯辰巳午未申酉戌亥'
  const i = Z.indexOf(monthZhi)
  if (i < 0) return null
  return i === 0 ? '亥' : Z[i - 1]!
}

function seasonFromMonthZhi(z: string): '春' | '夏' | '秋' | '冬' | null {
  if ('寅卯辰'.includes(z)) return '春'
  if ('巳午未'.includes(z)) return '夏'
  if ('申酉戌'.includes(z)) return '秋'
  if ('亥子丑'.includes(z)) return '冬'
  return null
}

const SI_FEI_BY_SEASON: Record<'春' | '夏' | '秋' | '冬', string[]> = {
  春: ['庚申', '辛酉'],
  夏: ['壬子', '癸亥'],
  秋: ['甲寅', '乙卯'],
  冬: ['丙午', '丁巳'],
}

const SHI_E_DA_BAI = new Set([
  '甲辰',
  '乙巳',
  '丙申',
  '丁亥',
  '戊戌',
  '己丑',
  '庚辰',
  '辛巳',
  '壬申',
  '癸亥',
])

const YIN_YANG_CHA_CUO = new Set([
  '丙子',
  '丁丑',
  '戊寅',
  '辛卯',
  '壬辰',
  '癸巳',
  '丙午',
  '丁未',
  '戊申',
  '辛酉',
  '壬戌',
  '癸亥',
])

const CHONG_PAIRS: [string, string][] = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
]

function chongPartner(z: string): string | null {
  for (const [a, b] of CHONG_PAIRS) {
    if (z === a) return b
    if (z === b) return a
  }
  return null
}

const KUI_GANG = new Set(['壬辰', '庚辰', '庚戌', '戊戌'])

/** 金神：日柱或时柱为乙丑、己巳、癸酉 */
const JIN_SHEN_GZ = new Set(['乙丑', '己巳', '癸酉'])

function hongLuanZhiForYearBranch(yearZhi: string): string | null {
  const m: Record<string, string> = {
    子: '卯',
    丑: '寅',
    寅: '丑',
    卯: '子',
    辰: '亥',
    巳: '戌',
    午: '酉',
    未: '申',
    申: '未',
    酉: '午',
    戌: '巳',
    亥: '辰',
  }
  return yearZhi ? m[yearZhi] ?? null : null
}

function tianXiZhiForYearBranch(yearZhi: string): string | null {
  const m: Record<string, string> = {
    子: '酉',
    丑: '申',
    寅: '未',
    卯: '午',
    辰: '巳',
    巳: '辰',
    午: '卯',
    未: '寅',
    申: '丑',
    酉: '子',
    戌: '亥',
    亥: '戌',
  }
  return yearZhi ? m[yearZhi] ?? null : null
}

/**
 * 天德贵人：以「月支」（十二月建）论，与问真等通书一致（非三合简表）。
 * 卯、午、酉月天德在地支；其余多为天干。
 */
type TianDeRule = { kind: 'stem'; v: string } | { kind: 'branch'; v: string }

const TIAN_DE_BY_MONTH_ZHI: Record<string, TianDeRule> = {
  寅: { kind: 'stem', v: '丁' },
  卯: { kind: 'branch', v: '申' },
  辰: { kind: 'stem', v: '壬' },
  巳: { kind: 'stem', v: '辛' },
  午: { kind: 'branch', v: '亥' },
  未: { kind: 'stem', v: '甲' },
  申: { kind: 'stem', v: '癸' },
  酉: { kind: 'branch', v: '寅' },
  戌: { kind: 'stem', v: '丙' },
  亥: { kind: 'stem', v: '乙' },
  子: { kind: 'stem', v: '巳' },
  丑: { kind: 'stem', v: '庚' },
}

function tianDeRuleForMonthZhi(monthZhi: string): TianDeRule | null {
  return monthZhi ? TIAN_DE_BY_MONTH_ZHI[monthZhi] ?? null : null
}

/** 天干五合之另一方 */
function stemHePartner(stem: string): string | null {
  const m: Record<string, string> = {
    甲: '己',
    己: '甲',
    乙: '庚',
    庚: '乙',
    丙: '辛',
    辛: '丙',
    丁: '壬',
    壬: '丁',
    戊: '癸',
    癸: '戊',
  }
  return m[stem] ?? null
}

/** 地支六合之另一方（用于地支型天德之「天德合」） */
function branchLiuHePartner(z: string): string | null {
  const m: Record<string, string> = {
    子: '丑',
    丑: '子',
    寅: '亥',
    亥: '寅',
    卯: '戌',
    戌: '卯',
    辰: '酉',
    酉: '辰',
    巳: '申',
    申: '巳',
    午: '未',
    未: '午',
  }
  return m[z] ?? null
}

/** 月德合（与月德相合之干） */
function yueDeHeStemForMonthZhi(monthZhi: string): string | null {
  const g = sanHeOfBranch(monthZhi)
  if (!g) return null
  const m: Record<SanHeKey, string> = {
    yinWuXu: '辛',
    shenZiChen: '丁',
    haiMaoWei: '己',
    siYouChou: '乙',
  }
  return m[g]
}

/** 天官贵人：日干见支 */
function tianGuanZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '未',
    乙: '申',
    丙: '酉',
    丁: '亥',
    戊: '子',
    己: '丑',
    庚: '寅',
    辛: '卯',
    壬: '辰',
    癸: '巳',
  }
  return gan ? m[gan] ?? null : null
}

/** 天厨贵人：日干见支（常见歌诀） */
function tianChuZhiForDayStem(gan: string): string | null {
  const m: Record<string, string> = {
    甲: '巳',
    乙: '午',
    丙: '子',
    丁: '巳',
    戊: '午',
    己: '申',
    庚: '寅',
    辛: '酉',
    壬: '亥',
    癸: '寅',
  }
  return gan ? m[gan] ?? null : null
}

/** 灾煞：三合局之冲位（与将星相冲） */
const ZAI_SHA_ZHI: Record<SanHeKey, string> = {
  shenZiChen: '午',
  yinWuXu: '子',
  siYouChou: '卯',
  haiMaoWei: '酉',
}

const ZHI_RING = '子丑寅卯辰巳午未申酉戌亥'

function sangMenZhi(yearZhi: string): string | null {
  const i = ZHI_RING.indexOf(yearZhi)
  if (i < 0) return null
  return ZHI_RING[(i + 2) % 12]!
}

function bingFuZhi(yearZhi: string): string | null {
  const i = ZHI_RING.indexOf(yearZhi)
  if (i < 0) return null
  return ZHI_RING[(i - 1 + 12) % 12]!
}

/** 十灵日 */
const SHI_LING_RI = new Set([
  '甲辰',
  '乙亥',
  '丙辰',
  '丁酉',
  '戊午',
  '庚戌',
  '庚寅',
  '辛亥',
  '壬寅',
  '癸未',
])

/** 八专日 */
const BA_ZHUAN_RI = new Set(['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑'])

/** 九丑日（淫欲煞） */
const JIU_CHOU_RI = new Set([
  '壬子',
  '壬午',
  '戊子',
  '戊午',
  '己酉',
  '己卯',
  '乙酉',
  '乙卯',
  '辛酉',
  '辛卯',
])

/** 日德 */
const RI_DE_RI = new Set(['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'])

/** 进神 / 退神 */
const JIN_SHEN_RI = new Set(['甲子', '甲午', '己卯', '己酉'])
const TUI_SHEN_RI = new Set(['壬辰', '壬戌', '癸巳', '癸亥'])

function tianSheGzForSeason(season: '春' | '夏' | '秋' | '冬'): string {
  const m = { 春: '戊寅', 夏: '甲午', 秋: '戊申', 冬: '甲子' } as const
  return m[season]
}

/** 德秀贵人：以月令三合局 + 天干（《三命通会》类取法） */
function deXiuSetsForMonthZhi(monthZhi: string): { de: Set<string>; xiu: Set<string> } | null {
  const g = sanHeOfBranch(monthZhi)
  if (!g) return null
  if (g === 'yinWuXu') return { de: new Set(['丙', '丁']), xiu: new Set(['戊', '癸', '辛']) }
  if (g === 'shenZiChen') return { de: new Set(['壬', '癸', '辛']), xiu: new Set(['丙', '丁', '戊', '乙']) }
  if (g === 'siYouChou') return { de: new Set(['庚', '辛']), xiu: new Set(['乙', '己']) }
  if (g === 'haiMaoWei') return { de: new Set(['甲', '乙']), xiu: new Set(['丁', '壬']) }
  return null
}

/** 孤鸾煞（日柱） */
const GU_LUAN_RI = new Set(['甲寅', '乙巳', '丙午', '丁巳', '戊申', '辛亥', '壬子', '癸亥'])

/** 童子煞：以常见童子日柱列表为主（流派多，与问真类盘接近） */
const TONG_ZI_RI = new Set([
  '甲寅',
  '甲子',
  '乙未',
  '丙申',
  '丁亥',
  '丁酉',
  '丁未',
  '戊子',
  '戊辰',
  '己丑',
  '己卯',
  '庚午',
  '辛巳',
  '壬寅',
  '壬辰',
  '癸丑',
  '癸未',
])

function parseKongZhi(s: string): Set<string> {
  const matches = s.match(/[子丑寅卯辰巳午未申酉戌亥]/g)
  return new Set(matches ?? [])
}

/** 天干在四柱中按年→月→日→时顺序是否依次出现（可隔柱） */
function stemsContainInOrder(stems: string[], seq: string[]): boolean {
  let j = 0
  for (const s of stems) {
    if (s === seq[j]) j++
    if (j === seq.length) return true
  }
  return false
}

const DISPLAY_ORDER: readonly string[] = [
  '天乙贵人',
  '太极贵人',
  '天德贵人',
  '天德合',
  '月德贵人',
  '月德合',
  '德秀贵人',
  '空亡',
  '天官贵人',
  '天厨贵人',
  '文昌贵人',
  '福星贵人',
  '国印贵人',
  '学堂',
  '词馆',
  '禄神',
  '羊刃',
  '飞刃',
  '金舆',
  '将星',
  '驿马',
  '桃花',
  '咸池',
  '华盖',
  '劫煞',
  '灾煞',
  '亡神',
  '红艳煞',
  '孤鸾煞',
  '童子煞',
  '流霞',
  '天医',
  '孤辰',
  '寡宿',
  '丧门',
  '吊客',
  '病符',
  '岁破',
  '十灵日',
  '八专日',
  '九丑日',
  '日德',
  '进神',
  '退神',
  '天赦日',
  '天上三奇',
  '地下三奇',
  '人中三奇',
  '十恶大败',
  '阴阳差错',
  '四废',
  '红鸾',
  '天喜',
  '金神',
  '魁罡',
]

function shenShaSortRank(name: string): number {
  const i = DISPLAY_ORDER.indexOf(name)
  return i >= 0 ? i : 99
}

function sortShenSha(names: string[], chongLabels: string[]) {
  const core = [...names].sort((a, b) => {
    const ra = shenShaSortRank(a)
    const rb = shenShaSortRank(b)
    if (ra !== rb) return ra - rb
    return a.localeCompare(b, 'zh-Hans-CN')
  })
  return [...core, ...chongLabels.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))]
}

/** 额外旬空：本柱旬、日旬、以及年柱旬空（xunKongPerPillar[0]）四柱见支即标「空亡」，贴近问真 */
export type ShenShaExtra = {
  /** 年/月/日/时各柱对应空亡字符串（如「戌亥」），本柱地支落其中则标「空亡」 */
  xunKongPerPillar?: string[]
  /** 日柱旬空，四柱任一支落入亦标「空亡」 */
  dayXunKong?: string
}

/**
 * 按四柱计算每柱神煞列表（中文名，已去重）。
 */
export function computeShenShaForPillars(
  p: FourPillars,
  extra?: ShenShaExtra,
): [string[], string[], string[], string[]] {
  const pillars = [p.year, p.month, p.day, p.time]
  const branches = pillars.map((x) => x.branch)
  const stems = pillars.map((x) => x.stem)
  const dayGan = p.day.stem
  const dayZhi = p.day.branch
  const yearZhi = p.year.branch
  const monthZhi = p.month.branch

  const out: string[][] = [[], [], [], []]
  const add = (pillarIdx: number, name: string) => {
    if (!out[pillarIdx].includes(name)) out[pillarIdx].push(name)
  }

  if (!dayGan || branchIndex(dayZhi) < 0) {
    return [out[0], out[1], out[2], out[3]]
  }

  const tianYi = tianYiGuiRenForDayStem(dayGan)
  const taiJi = taiJiGuiRenForDayStem(dayGan)
  const wc = wenChangForDayStem(dayGan)
  const fuXing = fuXingGuiRenForDayStem(dayGan)
  const lu = luZhiForDayStem(dayGan)
  const ren = yangRenForDayStem(dayGan)
  const jy = jinYuForDayStem(dayGan)
  const hy = hongYanForDayStem(dayGan)

  const shGroup = sanHeOfBranch(dayZhi)
  const extras = shGroup ? SAN_HE_EXTRAS[shGroup] : null
  const shGroupYear = yearZhi ? sanHeOfBranch(yearZhi) : null
  const extrasYear = shGroupYear ? SAN_HE_EXTRAS[shGroupYear] : null

  const yueDeGan = monthZhi ? yueDeGanForMonthBranch(monthZhi) : null
  const guChenZhi = yearZhi ? guChenForYearBranch(yearZhi) : null
  const guaSuZhi = yearZhi ? guaSuForYearBranch(yearZhi) : null

  const guoYin = guoYinZhiForDayStem(dayGan)
  const xueTang = xueTangZhiForDayStem(dayGan)
  const ciGuan = ciGuanZhiForDayStem(dayGan)
  const liuXia = liuXiaZhiForDayStem(dayGan)
  const tianYiZhi = monthZhi ? tianYiZhiForMonthZhi(monthZhi) : null
  const hongLuanZhi = yearZhi ? hongLuanZhiForYearBranch(yearZhi) : null
  const tianXiZhi = yearZhi ? tianXiZhiForYearBranch(yearZhi) : null

  const tianDeRule = monthZhi ? tianDeRuleForMonthZhi(monthZhi) : null
  const tianDeHeGan =
    tianDeRule?.kind === 'stem' ? stemHePartner(tianDeRule.v) : null
  const tianDeHeZhi =
    tianDeRule?.kind === 'branch' ? branchLiuHePartner(tianDeRule.v) : null
  const yueDeHeStem = monthZhi ? yueDeHeStemForMonthZhi(monthZhi) : null
  const deXiu = monthZhi ? deXiuSetsForMonthZhi(monthZhi) : null
  const tianGuan = tianGuanZhiForDayStem(dayGan)
  const tianChu = tianChuZhiForDayStem(dayGan)
  const feiRenZhi = ren ? chongPartner(ren) : null
  const sangMen = yearZhi ? sangMenZhi(yearZhi) : null
  const diaoKe = sangMen ? chongPartner(sangMen) : null
  const bingFu = yearZhi ? bingFuZhi(yearZhi) : null
  const suiPo = yearZhi ? chongPartner(yearZhi) : null

  /** 年柱一旬之空亡：四柱地支落入其中亦标「空亡」（如月支戌落庚午旬之戌亥，与问真月柱神煞一致） */
  const yearKongStr = extra?.xunKongPerPillar?.[0]
  const yearKongSet = yearKongStr ? parseKongZhi(yearKongStr) : null

  for (let i = 0; i < 4; i++) {
    const z = branches[i]
    const g = stems[i]
    if (!z) continue

    if (tianYi.has(z)) add(i, '天乙贵人')
    if (taiJi.has(z)) add(i, '太极贵人')
    if (tianDeRule) {
      if (tianDeRule.kind === 'stem' && g === tianDeRule.v) add(i, '天德贵人')
      if (tianDeRule.kind === 'branch' && z === tianDeRule.v) add(i, '天德贵人')
    }
    if (tianDeHeGan && g === tianDeHeGan) add(i, '天德合')
    if (tianDeHeZhi && z === tianDeHeZhi) add(i, '天德合')
    if (yueDeHeStem && g === yueDeHeStem) add(i, '月德合')
    if (deXiu && (deXiu.de.has(g) || deXiu.xiu.has(g))) add(i, '德秀贵人')
    if (tianGuan && z === tianGuan) add(i, '天官贵人')
    if (tianChu && z === tianChu) add(i, '天厨贵人')
    if (wc && wc === z) add(i, '文昌贵人')
    if (fuXing.has(z)) add(i, '福星贵人')
    if (guoYin && z === guoYin) add(i, '国印贵人')
    if (xueTang && z === xueTang) add(i, '学堂')
    if (ciGuan && z === ciGuan) add(i, '词馆')
    if (lu && lu === z) add(i, '禄神')
    if (ren && ren === z) add(i, '羊刃')
    if (feiRenZhi && z === feiRenZhi) add(i, '飞刃')
    if (jy && jy === z) add(i, '金舆')
    if (hy && hy === z) add(i, '红艳煞')
    if (liuXia && z === liuXia) add(i, '流霞')
    if (tianYiZhi && z === tianYiZhi) add(i, '天医')

    // 月德贵人：以德神落于月干为准（常见排盘仅标月柱）
    if (i === 1 && yueDeGan && g === yueDeGan) add(i, '月德贵人')

    if (extras && shGroup) {
      if (z === extras.jiang) add(i, '将星')
      if (z === extras.yiMa) add(i, '驿马')
      if (z === extras.taoHua) {
        add(i, '桃花')
        add(i, '咸池')
      }
      if (z === extras.huaGai) add(i, '华盖')
      if (z === extras.jieSha) add(i, '劫煞')
      if (z === ZAI_SHA_ZHI[shGroup]) add(i, '灾煞')
      if (z === extras.wangShen) add(i, '亡神')
    }
    // 以年支三合再查一遍（与以日支查并行，便于与部分排盘对照）
    if (extrasYear && shGroupYear) {
      if (z === extrasYear.jiang) add(i, '将星')
      if (z === extrasYear.yiMa) add(i, '驿马')
      if (z === extrasYear.taoHua) {
        add(i, '桃花')
        add(i, '咸池')
      }
      if (z === extrasYear.huaGai) add(i, '华盖')
      if (z === extrasYear.jieSha) add(i, '劫煞')
      if (z === ZAI_SHA_ZHI[shGroupYear]) add(i, '灾煞')
      if (z === extrasYear.wangShen) add(i, '亡神')
    }

    if (sangMen && z === sangMen) add(i, '丧门')
    if (diaoKe && z === diaoKe) add(i, '吊客')
    if (bingFu && z === bingFu) add(i, '病符')
    if (suiPo && z === suiPo) add(i, '岁破')

    if (guChenZhi && z === guChenZhi) add(i, '孤辰')
    if (guaSuZhi && z === guaSuZhi) add(i, '寡宿')
    if (hongLuanZhi && z === hongLuanZhi) add(i, '红鸾')
    if (tianXiZhi && z === tianXiZhi) add(i, '天喜')

    const gzCol = `${g}${z}`
    if (JIN_SHEN_GZ.has(gzCol)) add(i, '金神')

    if (extra?.dayXunKong && parseKongZhi(extra.dayXunKong).has(z)) add(i, '空亡')
    const xkCol = extra?.xunKongPerPillar?.[i]
    if (xkCol && parseKongZhi(xkCol).has(z)) add(i, '空亡')
    if (yearKongSet && yearKongSet.has(z)) add(i, '空亡')
  }

  // 魁罡：仅日柱全干支
  const dayGz = `${p.day.stem}${p.day.branch}`
  if (GU_LUAN_RI.has(dayGz)) add(2, '孤鸾煞')
  if (TONG_ZI_RI.has(dayGz)) add(2, '童子煞')
  if (KUI_GANG.has(dayGz)) add(2, '魁罡')
  if (SHI_E_DA_BAI.has(dayGz)) add(2, '十恶大败')
  if (YIN_YANG_CHA_CUO.has(dayGz)) add(2, '阴阳差错')
  const season = monthZhi ? seasonFromMonthZhi(monthZhi) : null
  if (season && SI_FEI_BY_SEASON[season].includes(dayGz)) add(2, '四废')

  if (SHI_LING_RI.has(dayGz)) add(2, '十灵日')
  if (BA_ZHUAN_RI.has(dayGz)) add(2, '八专日')
  if (JIU_CHOU_RI.has(dayGz)) add(2, '九丑日')
  if (RI_DE_RI.has(dayGz)) add(2, '日德')
  if (JIN_SHEN_RI.has(dayGz)) add(2, '进神')
  if (TUI_SHEN_RI.has(dayGz)) add(2, '退神')
  if (season && dayGz === tianSheGzForSeason(season)) add(2, '天赦日')

  const stemLine = [p.year.stem, p.month.stem, p.day.stem, p.time.stem]
  if (stemsContainInOrder(stemLine, ['甲', '戊', '庚'])) add(2, '天上三奇')
  if (stemsContainInOrder(stemLine, ['乙', '丙', '丁'])) add(2, '地下三奇')
  if (stemsContainInOrder(stemLine, ['壬', '癸', '辛'])) add(2, '人中三奇')

  // 地支六冲：在该柱注明与哪一柱相冲
  const chongExtras: string[][] = [[], [], [], []]
  for (let i = 0; i < 4; i++) {
    const z = branches[i]
    const partner = z ? chongPartner(z) : null
    if (!partner) continue
    for (let j = 0; j < 4; j++) {
      if (i === j) continue
      if (branches[j] === partner) {
        chongExtras[i].push(`冲${PILLAR_LABELS[j].replace('柱', '')}`)
      }
    }
  }

  return [
    sortShenSha(out[0], chongExtras[0]),
    sortShenSha(out[1], chongExtras[1]),
    sortShenSha(out[2], chongExtras[2]),
    sortShenSha(out[3], chongExtras[3]),
  ]
}
