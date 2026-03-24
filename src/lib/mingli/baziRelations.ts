type Element = '木' | '火' | '土' | '金' | '水'

const stemElement: Record<string, Element> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
}

// 五行相克：A 克 B
const elementControls: Record<Element, Element> = {
  木: '土',
  火: '金',
  土: '水',
  金: '木',
  水: '火',
}

type StemHe = { a: string; b: string; to: string; label: string }
const stemHePairs: StemHe[] = [
  { a: '甲', b: '己', to: '土', label: '甲己合土' },
  { a: '乙', b: '庚', to: '金', label: '乙庚合金' },
  { a: '丙', b: '辛', to: '水', label: '丙辛合化水' },
  { a: '丁', b: '壬', to: '木', label: '丁壬合木' },
  { a: '戊', b: '癸', to: '火', label: '戊癸合火' },
]

const stemChongPairs: Array<{ a: string; b: string; label: string }> = [
  { a: '甲', b: '庚', label: '甲庚相冲' },
  { a: '乙', b: '辛', label: '乙辛相冲' },
  { a: '丙', b: '壬', label: '丙壬相冲' },
  { a: '丁', b: '癸', label: '丁癸相冲' },
]

function pushUnique(out: string[], item: string, seen: Set<string>) {
  if (seen.has(item)) return
  seen.add(item)
  out.push(item)
}

function uniqueStems(stems: string[]): string[] {
  const set = new Set<string>()
  for (const s of stems) {
    const k = String(s || '').trim()
    if (!k) continue
    set.add(k)
  }
  return [...set]
}

export function computeOriginStemRelations(stems: string[]): string[] {
  const u = uniqueStems(stems)
  if (u.length === 0) return []

  const stemSet = new Set(u)
  const out: string[] = []
  const seen = new Set<string>()

  // 合化（天干合）
  for (const he of stemHePairs) {
    if (stemSet.has(he.a) && stemSet.has(he.b)) {
      pushUnique(out, he.label, seen)
    }
  }

  // 相冲（天干冲）
  for (const c of stemChongPairs) {
    if (stemSet.has(c.a) && stemSet.has(c.b)) pushUnique(out, c.label, seen)
  }

  return out
}

const threeHarmony = [
  { branches: ['寅', '午', '戌'], element: '火', label: '寅午戌三合火局' },
  { branches: ['申', '子', '辰'], element: '水', label: '申子辰三合水局' },
  { branches: ['巳', '酉', '丑'], element: '金', label: '巳酉丑三合金局' },
  { branches: ['亥', '卯', '未'], element: '木', label: '亥卯未三合木局' },
] as const

// 六冲
const chongPairs: [string, string][] = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
]

// 三刑：这里按你给的例子优先覆盖“寅巳申三刑”与“卯自刑”（子卯刑）等常见口径
const xingPairsInTriplets: Array<{ a: string; b: string; label: string }> = [
  { a: '申', b: '寅', label: '申寅相刑（寅巳申三刑）' },
  { a: '寅', b: '巳', label: '寅巳相刑（寅巳申三刑）' },
  { a: '巳', b: '申', label: '巳申相刑（寅巳申三刑）' },
  { a: '丑', b: '未', label: '丑未相刑（丑戌未三刑）' },
  { a: '未', b: '戌', label: '未戌相刑（丑戌未三刑）' },
  { a: '丑', b: '戌', label: '丑戌相刑（丑戌未三刑）' },
  { a: '子', b: '卯', label: '子卯相刑' },
]

// 六害
const haiPairs: [string, string][] = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌'],
]

const sixHePairs: Array<{ a: string; b: string; label: string }> = [
  { a: '子', b: '丑', label: '子丑六合' },
  { a: '寅', b: '亥', label: '寅亥六合' },
  { a: '卯', b: '戌', label: '卯戌六合' },
  { a: '辰', b: '酉', label: '辰酉六合' },
  { a: '巳', b: '申', label: '巳申六合' },
  { a: '午', b: '未', label: '午未六合' },
]

// 地支“主气”到五行（用于相克提示；这里用藏干主气简化口径）
const branchMainStem: Record<string, string> = {
  子: '癸',
  丑: '己',
  寅: '甲',
  卯: '乙',
  辰: '戊',
  巳: '丙',
  午: '丁',
  未: '己',
  申: '庚',
  酉: '辛',
  戌: '戊',
  亥: '壬',
}

function uniqBranches(branches: string[]): string[] {
  const set = new Set<string>()
  for (const b of branches) {
    const k = String(b || '').trim()
    if (!k) continue
    set.add(k)
  }
  return [...set]
}

function hasAll(set: Set<string>, items: string[]) {
  return items.every((x) => set.has(x))
}

export function computeOriginBranchRelations(branches: string[]): string[] {
  const u = uniqBranches(branches)
  if (u.length === 0) return []
  const set = new Set(u)

  const out: string[] = []
  const seen = new Set<string>()

  // 三合
  for (const t of threeHarmony) {
    if (hasAll(set, t.branches as unknown as string[])) {
      pushUnique(out, t.label, seen)
    }
  }

  // 六合
  for (const h of sixHePairs) {
    if (set.has(h.a) && set.has(h.b)) pushUnique(out, h.label, seen)
  }

  // 刑
  for (const item of xingPairsInTriplets) {
    if (set.has(item.a) && set.has(item.b)) pushUnique(out, item.label, seen)
  }

  // 冲
  for (const [a, b] of chongPairs) {
    if (set.has(a) && set.has(b)) {
      pushUnique(out, `${a}${b}相冲`, seen)
    }
  }

  // 克（按主气五行控制关系简化口径）
  for (const a of u) {
    const elA = stemElement[branchMainStem[a] ?? '']
    if (!elA) continue
    for (const b of u) {
      if (a === b) continue
      const elB = stemElement[branchMainStem[b] ?? '']
      if (!elB) continue
      if (elementControls[elA] === elB) pushUnique(out, `${a}${b}相克`, seen)
    }
  }

  // 相害：六害
  for (const [a, b] of haiPairs) {
    if (set.has(a) && set.has(b)) {
      pushUnique(out, `${a}${b}相害`, seen)
    }
  }

  return out
}

