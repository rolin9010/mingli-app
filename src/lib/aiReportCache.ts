import type { UserInput } from './types'

const STORAGE_KEY = 'mingli_ai_report_cache_v1'
/** 单条缓存上限（字符），避免撑爆 localStorage */
const MAX_MARKDOWN_CHARS = 800_000
/** 最多保留的指纹条数（LRU 按 savedAt） */
const MAX_ENTRIES = 15

type CacheEntry = {
  markdown: string
  savedAt: number
}

type CacheStore = Record<string, CacheEntry>

function djb2Hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return `v1_${(h >>> 0).toString(16)}`
}

/**
 * 仅由「用户填写/勾选的输入」生成指纹（v2）。
 * 不把整份 `results` 序列化进指纹：排盘对象字段顺序、浮点等会导致每次 hash 不一致，缓存永远命中不了。
 */
export function computeAiReportFingerprint(input: UserInput): string {
  const payload = {
    v: 2,
    name: (input.name ?? '').trim(),
    birth: {
      year: input.birth.year,
      month: input.birth.month,
      day: input.birth.day,
      hour: input.birth.hour,
      minute: input.birth.minute ?? 0,
    },
    gender: input.gender,
    bloodType: input.bloodType ?? null,
    mbti: input.mbti ?? null,
    mbtiDimensions: input.mbtiDimensions ?? null,
    calendarType: input.calendarType ?? null,
    country: input.country ?? '',
    province: input.province ?? '',
    city: input.city ?? '',
    district: input.district ?? '',
    saveData: Boolean(input.saveData),
    useSolarTime: Boolean(input.useSolarTime),
    selectedChartSystems: [...(input.selectedChartSystems ?? [])].sort(),
  }
  return djb2Hash(JSON.stringify(payload))
}

function loadStore(): CacheStore {
  if (typeof window === 'undefined') return {}
  try {
    const rawLocal = localStorage.getItem(STORAGE_KEY)
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as unknown
      if (parsed && typeof parsed === 'object') return parsed as CacheStore
    }
    const rawSession = sessionStorage.getItem(STORAGE_KEY)
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as unknown
      if (parsed && typeof parsed === 'object') return parsed as CacheStore
    }
    return {}
  } catch {
    return {}
  }
}

function saveStore(store: CacheStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

function pruneStore(store: CacheStore): CacheStore {
  const keys = Object.keys(store)
  if (keys.length <= MAX_ENTRIES) return store
  const sorted = keys.sort((a, b) => (store[a]!.savedAt ?? 0) - (store[b]!.savedAt ?? 0))
  const drop = sorted.slice(0, keys.length - MAX_ENTRIES)
  const next = { ...store }
  for (const k of drop) delete next[k]
  return next
}

/** 读取本地缓存的 AI 解读正文 */
export function getCachedAiReport(fingerprint: string): string | null {
  const store = loadStore()
  const e = store[fingerprint]
  if (!e?.markdown || typeof e.markdown !== 'string') return null
  return e.markdown
}

/** 写入缓存（生成成功或从网络拿到新正文时调用） */
export function setCachedAiReport(fingerprint: string, markdown: string): void {
  if (!markdown || markdown.length > MAX_MARKDOWN_CHARS) return
  let store = loadStore()
  store[fingerprint] = { markdown, savedAt: Date.now() }
  store = pruneStore(store)
  saveStore(store)
}

/** 仅「重新生成」前可调用，避免仍命中旧缓存 */
export function clearCachedAiReport(fingerprint: string): void {
  if (typeof window === 'undefined') return
  const store = loadStore()
  if (!store[fingerprint]) return
  delete store[fingerprint]
  saveStore(store)
}
