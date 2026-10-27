export const BIRTH_YEAR_MIN = 1906
export const BIRTH_YEAR_MAX = 2050

/** 公历年份列表，倒序方便用户先看到最近年份。 */
export function buildBirthYears(
  min = BIRTH_YEAR_MIN,
  max = BIRTH_YEAR_MAX,
): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) return []
  return Array.from({ length: max - min + 1 }, (_, index) => max - index)
}

export const BIRTH_YEARS = buildBirthYears()
