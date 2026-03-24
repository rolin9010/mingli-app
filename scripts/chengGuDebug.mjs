import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const chengGuPath = path.join(projectRoot, 'src/lib/mingli/chengGu.ts')
const ts = fs.readFileSync(chengGuPath, 'utf8')

function extractConstObjectByBraces(constName) {
  const start = ts.indexOf(`const ${constName}`)
  if (start < 0) throw new Error(`Cannot find const: ${constName}`)
  const eq = ts.indexOf('=', start)
  const braceStart = ts.indexOf('{', eq)
  if (braceStart < 0) throw new Error(`Cannot find '{' for ${constName}`)
  let depth = 0
  for (let i = braceStart; i < ts.length; i++) {
    const ch = ts[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const rawObj = ts.slice(braceStart, i + 1)
        return eval('(' + rawObj + ')')
      }
    }
  }
  throw new Error(`Cannot extract object: ${constName}`)
}

function extractConstArrayByBrackets(constName) {
  const start = ts.indexOf(`const ${constName}`)
  if (start < 0) throw new Error(`Cannot find const: ${constName}`)
  const eq = ts.indexOf('=', start)
  const bracketStart = ts.indexOf('[', eq)
  if (bracketStart < 0) throw new Error(`Cannot find '[' for ${constName}`)
  let depth = 0
  for (let i = bracketStart; i < ts.length; i++) {
    const ch = ts[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        const rawArr = ts.slice(bracketStart, i + 1)
        return eval(rawArr)
      }
    }
  }
  throw new Error(`Cannot extract array: ${constName}`)
}

const YEAR_QIAN = extractConstObjectByBraces('YEAR_QIAN')
const MONTH_QIAN = extractConstArrayByBrackets('MONTH_QIAN')
const LUNAR_DAY_QIAN = extractConstArrayByBrackets('LUNAR_DAY_QIAN')
const BRANCH_HOUR_QIAN = extractConstObjectByBraces('BRANCH_HOUR_QIAN')

function parseBranch(ganzhi) {
  return ganzhi?.match(/[子丑寅卯辰巳午未申酉戌亥]/)?.[0]
}

function formatWeightLabel(totalQian) {
  const liang = Math.floor(totalQian / 10)
  const qian = totalQian % 10
  if (qian === 0) return `${liang}两`
  return `${liang}两${qian}钱`
}

const { Solar } = await import('lunar-javascript')

// test: 1992-04-20 06:59 (local time)
const year = 1992
const month = 4
const day = 20
const hour = 6
const minute = 59

const lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar()
const eightChar = lunar.getEightChar()

const y = YEAR_QIAN[eightChar.getYear()] ?? 0
let m = lunar.getMonth()
if (m < 0) m = Math.abs(m)
const mWeight = MONTH_QIAN[Math.min(12, Math.max(1, m)) - 1] ?? 0

const dayNum = Math.min(30, Math.max(1, lunar.getDay()))
const dWeight = LUNAR_DAY_QIAN[dayNum] ?? 0

const br = parseBranch(eightChar.getTime())
const hWeight = br ? (BRANCH_HOUR_QIAN[br] ?? 0) : 0

const totalQian = y + mWeight + dWeight + hWeight

console.log('--- chengGu debug ---')
console.log({
  input: `${year}-${month}-${day} ${hour}:${minute}`,
  eightChar: {
    year: eightChar.getYear(),
    month: eightChar.getMonth(),
    day: eightChar.getDay(),
    time: eightChar.getTime(),
  },
  lunar: {
    month: lunar.getMonth(),
    day: lunar.getDay(),
  },
  weights: {
    y,
    m: mWeight,
    d: dWeight,
    h: hWeight,
  },
  debugTables: {
    LUNAR_DAY_QIAN_len: LUNAR_DAY_QIAN.length,
    LUNAR_DAY_QIAN_day18: LUNAR_DAY_QIAN[18],
    LUNAR_DAY_QIAN_day3: LUNAR_DAY_QIAN[3],
  },
  branch: br,
  totalQian,
  weightLabel: formatWeightLabel(totalQian),
})

