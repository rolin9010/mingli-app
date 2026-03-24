/**
 * 人类图：闸门/爻线采用 hdkit sample-apps/v1/substructure.js 的黄道映射（+58° 偏移 + 64 分扇区）；
 * 设计时刻为太阳黄道经度相对出生时刻逆行约 88° 的时刻（二分法逼近）；
 * 类型/内在权威由 36 条官方通道与能量中心连通性推导。
 * 说明：与商业排盘软件在交点算法等细节上可能略有差异，仅供学习与自我探索参考。
 */
import * as Astronomy from 'astronomy-engine'
import { lunarTrueAscendingNodeLongitude, utcDateFromLocalWall } from './astro'

/** Rave Mandala 顺序（与 jdempcy/hdkit constants.js 一致） */
export const HD_GATE_ORDER = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
] as const

export type HdCenterKey = 'head' | 'ajna' | 'throat' | 'g' | 'ego' | 'solar' | 'sacral' | 'spleen' | 'root'

export type HdActivation = {
  gate: number
  line: number
}

export type HdBodyRow = {
  key: string
  label: string
  lonDeg: number
} & HdActivation

/** 36 条通道（闸门序号已规范为 a<b），两端能量中心 */
export const HD_CHANNELS: { a: number; b: number; c1: HdCenterKey; c2: HdCenterKey; nameZh: string }[] = [
  { a: 1, b: 8, c1: 'g', c2: 'throat', nameZh: '启迪' },
  { a: 2, b: 14, c1: 'g', c2: 'sacral', nameZh: '脉动' },
  { a: 3, b: 60, c1: 'sacral', c2: 'root', nameZh: '突变' },
  { a: 4, b: 63, c1: 'head', c2: 'ajna', nameZh: '逻辑' },
  { a: 5, b: 15, c1: 'sacral', c2: 'g', nameZh: '节律' },
  { a: 6, b: 59, c1: 'sacral', c2: 'solar', nameZh: '亲密' },
  { a: 7, b: 31, c1: 'g', c2: 'throat', nameZh: '领导（α）' },
  { a: 9, b: 52, c1: 'sacral', c2: 'root', nameZh: '专注' },
  { a: 10, b: 20, c1: 'g', c2: 'throat', nameZh: '觉醒' },
  { a: 10, b: 34, c1: 'g', c2: 'sacral', nameZh: '探索' },
  { a: 10, b: 57, c1: 'g', c2: 'spleen', nameZh: '完美形态' },
  { a: 11, b: 56, c1: 'ajna', c2: 'throat', nameZh: '好奇' },
  { a: 12, b: 22, c1: 'throat', c2: 'solar', nameZh: '开放' },
  { a: 13, b: 33, c1: 'g', c2: 'throat', nameZh: '见证' },
  { a: 16, b: 48, c1: 'spleen', c2: 'throat', nameZh: '才华' },
  { a: 17, b: 62, c1: 'ajna', c2: 'throat', nameZh: '接纳' },
  { a: 18, b: 58, c1: 'spleen', c2: 'root', nameZh: '判断' },
  { a: 19, b: 49, c1: 'root', c2: 'solar', nameZh: '合成' },
  { a: 20, b: 57, c1: 'throat', c2: 'spleen', nameZh: '脑波' },
  { a: 21, b: 45, c1: 'ego', c2: 'throat', nameZh: '金钱线' },
  { a: 23, b: 43, c1: 'throat', c2: 'ajna', nameZh: '结构化' },
  { a: 24, b: 61, c1: 'ajna', c2: 'throat', nameZh: '觉知' },
  { a: 25, b: 51, c1: 'g', c2: 'throat', nameZh: '发起' },
  { a: 26, b: 44, c1: 'ego', c2: 'spleen', nameZh: '传送' },
  { a: 27, b: 50, c1: 'sacral', c2: 'spleen', nameZh: '保存' },
  { a: 28, b: 38, c1: 'spleen', c2: 'root', nameZh: '挣扎' },
  { a: 29, b: 46, c1: 'sacral', c2: 'g', nameZh: '发现' },
  { a: 30, b: 41, c1: 'solar', c2: 'throat', nameZh: '认可' },
  { a: 32, b: 54, c1: 'spleen', c2: 'root', nameZh: '转化' },
  { a: 34, b: 20, c1: 'sacral', c2: 'throat', nameZh: '魅力' },
  { a: 35, b: 36, c1: 'throat', c2: 'solar', nameZh: '无常' },
  { a: 37, b: 40, c1: 'solar', c2: 'throat', nameZh: '社群' },
  { a: 39, b: 55, c1: 'root', c2: 'solar', nameZh: '挑衅' },
  { a: 42, b: 53, c1: 'sacral', c2: 'root', nameZh: '成熟' },
  { a: 47, b: 64, c1: 'ajna', c2: 'head', nameZh: '抽象' },
  { a: 48, b: 16, c1: 'spleen', c2: 'throat', nameZh: '深度' },
]

function mod360(x: number): number {
  let y = x % 360
  if (y < 0) y += 360
  return y
}

/** hdkit：热带黄道经度（0°=白羊起点）→ 闸门+爻线 */
export function lonDegToGateLine(lonDeg: number): HdActivation {
  const signDegrees = mod360(lonDeg + 58)
  const pct = signDegrees / 360
  const idx = Math.min(63, Math.floor(pct * 64))
  const gate = HD_GATE_ORDER[idx]
  const exactLine = 384 * pct
  const line = (Math.floor(exactLine) % 6) + 1
  return { gate, line }
}

export function oppositeGate(gate: number): number {
  const idx = HD_GATE_ORDER.indexOf(gate as (typeof HD_GATE_ORDER)[number])
  if (idx < 0) return gate
  return HD_GATE_ORDER[(idx + 32) % 64]
}

function sunEclipticLonDeg(date: Date): number {
  const v = Astronomy.GeoVector(Astronomy.Body.Sun, date, true)
  return mod360(Astronomy.Ecliptic(v).elon)
}

/** 相对 birth，太阳黄道「顺行」累计到约 88° 时的时刻（设计时刻） */
export function findDesignDateUtc(birth: Date): Date {
  const sb = sunEclipticLonDeg(birth)
  const arcForward = (fromT: number): number => {
    const s = sunEclipticLonDeg(new Date(fromT))
    return mod360(sb - s)
  }
  let lo = birth.getTime() - 130 * 86400000
  let hi = birth.getTime() - 3600000
  if (arcForward(lo) < 88) lo -= 60 * 86400000
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const arc = arcForward(mid)
    if (arc > 88) lo = mid
    else hi = mid
  }
  return new Date((lo + hi) / 2)
}

function geoLonDeg(body: Astronomy.Body, date: Date): number {
  const v = Astronomy.GeoVector(body, date, true)
  return mod360(Astronomy.Ecliptic(v).elon)
}

function lunarNorthSouthLonDeg(jdUt: number): { north: number; south: number } {
  const north = lunarTrueAscendingNodeLongitude(jdUt)
  return { north, south: mod360(north + 180) }
}

function jdUtFromUtcDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5
}

const ALL_HD_CENTERS: HdCenterKey[] = ['head', 'ajna', 'throat', 'g', 'ego', 'solar', 'sacral', 'spleen', 'root']

export type HumanDesignResult = {
  designTimeIso: string
  profile: string
  personality: {
    sun: HdBodyRow
    earth: HdBodyRow
    moon: HdBodyRow
    northNode: HdBodyRow
    southNode: HdBodyRow
    mercury: HdBodyRow
    venus: HdBodyRow
    mars: HdBodyRow
    jupiter: HdBodyRow
    saturn: HdBodyRow
    uranus: HdBodyRow
    neptune: HdBodyRow
    pluto: HdBodyRow
  }
  design: {
    sun: HdBodyRow
    earth: HdBodyRow
    moon: HdBodyRow
    northNode: HdBodyRow
    southNode: HdBodyRow
    mercury: HdBodyRow
    venus: HdBodyRow
    mars: HdBodyRow
    jupiter: HdBodyRow
    saturn: HdBodyRow
    uranus: HdBodyRow
    neptune: HdBodyRow
    pluto: HdBodyRow
  }
  /** 两端闸门均被「黑+红」任意一侧激活即视为接通 */
  activeChannels: { a: number; b: number; nameZh: string }[]
  definedCenters: HdCenterKey[]
  type: string
  strategy: string
  authority: string
}

function row(key: string, label: string, lonDeg: number): HdBodyRow {
  const { gate, line } = lonDegToGateLine(lonDeg)
  return { key, label, lonDeg, gate, line }
}

function collectActivatedGates(r: HumanDesignResult['personality'], d: HumanDesignResult['design']): Set<number> {
  const s = new Set<number>()
  const add = (x: HdBodyRow) => {
    s.add(x.gate)
  }
  const both = (o: typeof r) => {
    add(o.sun)
    add(o.earth)
    add(o.moon)
    add(o.northNode)
    add(o.southNode)
    add(o.mercury)
    add(o.venus)
    add(o.mars)
    add(o.jupiter)
    add(o.saturn)
    add(o.uranus)
    add(o.neptune)
    add(o.pluto)
  }
  both(r)
  both(d)
  return s
}

function addSideGates(o: HumanDesignResult['personality'], s: Set<number>) {
  s.add(o.sun.gate)
  s.add(o.earth.gate)
  s.add(o.moon.gate)
  s.add(o.northNode.gate)
  s.add(o.southNode.gate)
  s.add(o.mercury.gate)
  s.add(o.venus.gate)
  s.add(o.mars.gate)
  s.add(o.jupiter.gate)
  s.add(o.saturn.gate)
  s.add(o.uranus.gate)
  s.add(o.neptune.gate)
  s.add(o.pluto.gate)
}

/** 仅个性（出生时刻）激活的闸门集合 */
export function gatesSetFromPersonality(p: HumanDesignResult['personality']): Set<number> {
  const s = new Set<number>()
  addSideGates(p, s)
  return s
}

/** 仅设计（设计时刻）激活的闸门集合 */
export function gatesSetFromDesign(d: HumanDesignResult['design']): Set<number> {
  const s = new Set<number>()
  addSideGates(d, s)
  return s
}

/**
 * 标准 BodyGraph 中各闸门所属能量中心（与常见权威图一致，用于在图上聚合展示）
 * 64 闸门各出现一次。
 */
export const HD_GATE_HOME_CENTER: Record<number, HdCenterKey> = {
  64: 'head',
  61: 'head',
  63: 'head',
  47: 'head',
  24: 'ajna',
  4: 'ajna',
  11: 'ajna',
  17: 'ajna',
  43: 'ajna',
  23: 'ajna',
  62: 'throat',
  56: 'throat',
  35: 'throat',
  12: 'throat',
  45: 'throat',
  33: 'throat',
  8: 'throat',
  31: 'throat',
  20: 'throat',
  16: 'throat',
  7: 'g',
  1: 'g',
  13: 'g',
  10: 'g',
  15: 'g',
  2: 'g',
  46: 'g',
  25: 'g',
  21: 'ego',
  40: 'ego',
  26: 'ego',
  51: 'ego',
  6: 'solar',
  37: 'solar',
  22: 'solar',
  36: 'solar',
  30: 'solar',
  55: 'solar',
  49: 'solar',
  41: 'solar',
  5: 'sacral',
  14: 'sacral',
  29: 'sacral',
  59: 'sacral',
  9: 'sacral',
  3: 'sacral',
  42: 'sacral',
  27: 'sacral',
  34: 'sacral',
  48: 'spleen',
  44: 'spleen',
  50: 'spleen',
  32: 'spleen',
  28: 'spleen',
  18: 'spleen',
  57: 'spleen',
  53: 'root',
  60: 'root',
  52: 'root',
  19: 'root',
  39: 'root',
  58: 'root',
  38: 'root',
  54: 'root',
}

export function getChannelByGates(a: number, b: number) {
  return HD_CHANNELS.find((ch) => (ch.a === a && ch.b === b) || (ch.a === b && ch.b === a))
}

/** 通道着色：纯个性 / 纯设计 / 两侧均有（同色接通）/ 黑白各一端凑成通道 */
export type HdChannelStrokeKind = 'personality' | 'design' | 'both' | 'hybrid'

export function channelStrokeKind(
  ch: { a: number; b: number },
  pGates: Set<number>,
  dGates: Set<number>,
): HdChannelStrokeKind {
  const pa = pGates.has(ch.a) && pGates.has(ch.b)
  const da = dGates.has(ch.a) && dGates.has(ch.b)
  if (pa && da) return 'both'
  if (pa) return 'personality'
  if (da) return 'design'
  return 'hybrid'
}

function centerLabelZh(c: HdCenterKey): string {
  const m: Record<HdCenterKey, string> = {
    head: '顶轮',
    ajna: '眉心',
    throat: '喉轮',
    g: 'G 中心',
    ego: '心轮/意志',
    solar: '情绪中心',
    sacral: '荐骨',
    spleen: '脾脏',
    root: '根轮',
  }
  return m[c]
}

function inferTypeAndAuthority(defined: Set<HdCenterKey>, activeCh: typeof HD_CHANNELS): Pick<HumanDesignResult, 'type' | 'strategy' | 'authority'> {
  const has = (c: HdCenterKey) => defined.has(c)
  const motors: HdCenterKey[] = ['root', 'sacral', 'solar', 'ego']

  const adj = new Map<HdCenterKey, Set<HdCenterKey>>()
  const addEdge = (u: HdCenterKey, v: HdCenterKey) => {
    if (!adj.has(u)) adj.set(u, new Set())
    if (!adj.has(v)) adj.set(v, new Set())
    adj.get(u)!.add(v)
    adj.get(v)!.add(u)
  }
  for (const ch of activeCh) {
    addEdge(ch.c1, ch.c2)
  }

  const bfsReach = (starts: HdCenterKey[], goal: HdCenterKey): boolean => {
    const q = starts.filter(has)
    const seen = new Set<HdCenterKey>(q)
    while (q.length) {
      const u = q.shift()!
      if (u === goal) return true
      for (const v of adj.get(u) ?? []) {
        if (!has(v) || seen.has(v)) continue
        seen.add(v)
        q.push(v)
      }
    }
    return false
  }

  const motorToThroat = (): boolean => {
    for (const m of motors) {
      if (has(m) && bfsReach([m], 'throat')) return true
    }
    return false
  }

  const sacralToThroat = has('sacral') && bfsReach(['sacral'], 'throat')

  if (defined.size === 0) {
    return { type: '反映者', strategy: '等待一个完整的月亮周期再做重大决定', authority: '月亮权威' }
  }

  if (has('sacral')) {
    if (sacralToThroat) {
      return {
        type: '显示生产者',
        strategy: '先回应荐骨的「嗯/唔」，能量到位时可快速多线程推进',
        authority: has('solar') ? '情绪权威' : '荐骨权威',
      }
    }
    return {
      type: '生产者',
      strategy: '等待外界可回应的刺激，用荐骨回应「是/否」',
      authority: has('solar') ? '情绪权威' : '荐骨权威',
    }
  }

  if (motorToThroat()) {
    return { type: '显示者', strategy: '行动前告知身边人，减少阻力', authority: innerAuthorityHeuristic(has, adj) }
  }

  return {
    type: '投射者',
    strategy: '等待认可与邀请，再输出洞见与引导',
    authority: innerAuthorityHeuristic(has, adj),
  }
}

function innerAuthorityHeuristic(
  has: (c: HdCenterKey) => boolean,
  adj: Map<HdCenterKey, Set<HdCenterKey>>,
): string {
  if (has('solar')) return '情绪权威'
  if (has('sacral')) return '荐骨权威'
  if (has('spleen')) return '脾脏权威'
  const egoThroat =
    has('ego') &&
    (() => {
      const q: HdCenterKey[] = ['ego']
      const seen = new Set(q)
      while (q.length) {
        const u = q.shift()!
        if (u === 'throat') return true
        for (const v of adj.get(u) ?? []) {
          if (!has(v) || seen.has(v)) continue
          seen.add(v)
          q.push(v)
        }
      }
      return false
    })()
  if (egoThroat) return '自我（意志）权威'
  const gThroat =
    has('g') &&
    (() => {
      const q: HdCenterKey[] = ['g']
      const seen = new Set(q)
      while (q.length) {
        const u = q.shift()!
        if (u === 'throat') return true
        for (const v of adj.get(u) ?? []) {
          if (!has(v) || seen.has(v)) continue
          seen.add(v)
          q.push(v)
        }
      }
      return false
    })()
  if (gThroat) return '自我投射'
  if (has('ajna') && has('head')) {
    const linked =
      (adj.get('ajna')?.has('head') && has('throat')) ||
      (() => {
        const q: HdCenterKey[] = ['head']
        const seen = new Set(q)
        while (q.length) {
          const u = q.shift()!
          if (u === 'throat') return true
          for (const v of adj.get(u) ?? []) {
            if (!has(v) || seen.has(v)) continue
            seen.add(v)
            q.push(v)
          }
        }
        return false
      })()
    if (linked) return '外在权威（环境/讨论）'
  }
  return '月亮权威'
}

export function calcHumanDesign(birthUtc: Date): HumanDesignResult {
  const designDate = findDesignDateUtc(birthUtc)

  const buildSide = (d: Date): HumanDesignResult['personality'] => {
    const jd = jdUtFromUtcDate(d)
    const { north: nn, south: sn } = lunarNorthSouthLonDeg(jd)
    const sunLon = sunEclipticLonDeg(d)
    return {
      sun: row('sun', '太阳', sunLon),
      earth: row('earth', '地球', mod360(sunLon + 180)),
      moon: row('moon', '月亮', geoLonDeg(Astronomy.Body.Moon, d)),
      northNode: row('nn', '北交点', nn),
      southNode: row('sn', '南交点', sn),
      mercury: row('mercury', '水星', geoLonDeg(Astronomy.Body.Mercury, d)),
      venus: row('venus', '金星', geoLonDeg(Astronomy.Body.Venus, d)),
      mars: row('mars', '火星', geoLonDeg(Astronomy.Body.Mars, d)),
      jupiter: row('jupiter', '木星', geoLonDeg(Astronomy.Body.Jupiter, d)),
      saturn: row('saturn', '土星', geoLonDeg(Astronomy.Body.Saturn, d)),
      uranus: row('uranus', '天王星', geoLonDeg(Astronomy.Body.Uranus, d)),
      neptune: row('neptune', '海王星', geoLonDeg(Astronomy.Body.Neptune, d)),
      pluto: row('pluto', '冥王星', geoLonDeg(Astronomy.Body.Pluto, d)),
    }
  }

  const personality = buildSide(birthUtc)
  const design = buildSide(designDate)

  const gates = collectActivatedGates(personality, design)
  const activeChannels = HD_CHANNELS.filter((ch) => gates.has(ch.a) && gates.has(ch.b)).map((ch) => ({
    a: ch.a,
    b: ch.b,
    nameZh: ch.nameZh,
  }))

  const definedCentersSet = new Set<HdCenterKey>()
  for (const ch of HD_CHANNELS) {
    if (gates.has(ch.a) && gates.has(ch.b)) {
      definedCentersSet.add(ch.c1)
      definedCentersSet.add(ch.c2)
    }
  }
  const definedCenters = ALL_HD_CENTERS.filter((c) => definedCentersSet.has(c))

  const { type, strategy, authority } = inferTypeAndAuthority(
    definedCentersSet,
    HD_CHANNELS.filter((ch) => gates.has(ch.a) && gates.has(ch.b)),
  )

  const profile = `${personality.sun.line}/${design.sun.line}`

  return {
    designTimeIso: designDate.toISOString(),
    profile,
    personality,
    design,
    activeChannels,
    definedCenters,
    type,
    strategy,
    authority,
  }
}

/** 与西洋盘一致：出生地墙钟 + 时区 */
export function calcHumanDesignFromWallClock(
  gregorian: { year: number; month: number; day: number; hour: number; minute: number },
  tzEast: number,
): HumanDesignResult {
  return calcHumanDesign(utcDateFromLocalWall(gregorian, tzEast))
}

export { centerLabelZh }
