export function hashStringToUint32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickUnique<T>(arr: T[], count: number, rng: () => number): T[] {
  if (count >= arr.length) return [...arr]
  const copy = [...arr]
  const picked: T[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * copy.length)
    picked.push(copy[idx]!)
    copy.splice(idx, 1)
  }
  return picked
}

