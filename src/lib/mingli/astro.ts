/**
 * 西洋本命盘：行星/日月 astronomy-engine 地心黄道；
 * 上升/天顶/宫位：GAST + 真黄赤交角 + Swiss 式 Asc1 与普拉西德宫制；
 * 北交点：平交点 + 主要摄动项；婚神星：JPL 根数 + 开普勒，再经日心→地心三维向量差。
 */
import * as Astronomy from 'astronomy-engine'
import { computePlacidus, placidusHouseForLongitude } from './placidusSwiss'
import { calcSolarSign } from './solar'

export interface AstroPlanet {
  sign: string
  symbol: string
  degree: number
  degreeInSign: string
  house?: number
  retrograde?: boolean
  planetSymbol: string
}

export interface AstroResult {
  sun: AstroPlanet
  moon: AstroPlanet
  ascendant: AstroPlanet
  mercury: AstroPlanet
  venus: AstroPlanet
  mars: AstroPlanet
  jupiter: AstroPlanet
  saturn: AstroPlanet
  uranus: AstroPlanet
  neptune: AstroPlanet
  pluto: AstroPlanet
  /** 北交点（升交点，真交点近似） */
  northNode: AstroPlanet
  /** 南交点 */
  southNode: AstroPlanet
  /** 天顶 MC */
  mc: AstroPlanet
  /** 婚神星 Juno */
  juno: AstroPlanet
}

const ZODIAC = [
  '白羊座',
  '金牛座',
  '双子座',
  '巨蟹座',
  '狮子座',
  '处女座',
  '天秤座',
  '天蝎座',
  '射手座',
  '摩羯座',
  '水瓶座',
  '双鱼座',
] as const

const ZODIAC_SYM = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] as const

const RAD = Math.PI / 180

function mod360(x: number): number {
  return ((x % 360) + 360) % 360
}

function longitudeToSign(longitude: number): string {
  const lon = mod360(longitude)
  const i = Math.min(11, Math.floor(lon / 30))
  return ZODIAC[i]
}

function zodiacGlyph(signName: string): string {
  const i = ZODIAC.indexOf(signName as (typeof ZODIAC)[number])
  return i >= 0 ? ZODIAC_SYM[i] : '—'
}

function signShort(full: string): string {
  return full.replace(/座$/, '')
}

/** 宫内度、分（修正：原先用 d%1 会错） */
function formatDegreeInSign(deg: number): string {
  const d = mod360(deg)
  const inSign = d % 30
  const degInt = Math.floor(inSign)
  const minFloat = (inSign - degInt) * 60
  const minInt = Math.min(59, Math.floor(minFloat + 0.5))
  return `${degInt}°${String(minInt).padStart(2, '0')}'`
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonth(y: number, m: number): number {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m === 2) return isLeapYear(y) ? 29 : 28
  return dim[m - 1] ?? 31
}

/** 本地墙钟 + 东八区时区 → UTC 日历与当日 UT（小数时） */
function localWallToUtcParts(
  y: number,
  mo: number,
  d: number,
  localH: number,
  localMin: number,
  tzEast: number,
): { y: number; m: number; d: number; ut: number } {
  let ut = localH + localMin / 60 - tzEast
  let yy = y
  let mm = mo
  let dd = d
  while (ut < 0) {
    ut += 24
    dd -= 1
    if (dd < 1) {
      mm -= 1
      if (mm < 1) {
        mm = 12
        yy -= 1
      }
      dd = daysInMonth(yy, mm)
    }
  }
  while (ut >= 24) {
    ut -= 24
    dd += 1
    const dim = daysInMonth(yy, mm)
    if (dd > dim) {
      dd = 1
      mm += 1
      if (mm > 12) {
        mm = 1
        yy += 1
      }
    }
  }
  return { y: yy, m: mm, d: dd, ut }
}

/** 格里历 UT 的儒略日 */
function julianDayUtGregorian(y: number, month: number, day: number, ut: number): number {
  let Y = y
  let M = month
  if (M <= 2) {
    Y -= 1
    M += 12
  }
  const A = Math.floor(Y / 100)
  const B = 2 - A + Math.floor(A / 4)
  const JD0 =
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day +
    B -
    1524.5
  return JD0 + ut / 24
}

function julianDayFromLocalWall(
  y: number,
  mo: number,
  d: number,
  localH: number,
  localMin: number,
  tzEast: number,
): number {
  const { y: uy, m: um, d: ud, ut } = localWallToUtcParts(y, mo, d, localH, localMin, tzEast)
  return julianDayUtGregorian(uy, um, ud, ut)
}

/** JD(UT) → JavaScript Date（UTC 瞬时） */
function jdUtToDate(jd: number): Date {
  const ms = (jd - 2440587.5) * 86400000
  return new Date(ms)
}

/** 本地墙钟 + 东时区 → UTC 瞬时（与人类图/占星排盘一致） */
export function utcDateFromLocalWall(
  gregorian: { year: number; month: number; day: number; hour: number; minute: number },
  tzEast: number,
): Date {
  const jd = julianDayFromLocalWall(
    gregorian.year,
    gregorian.month,
    gregorian.day,
    gregorian.hour,
    gregorian.minute,
    tzEast,
  )
  return jdUtToDate(jd)
}

function wholeSignHouse(planetLon: number, ascLon: number): number {
  return Math.floor(((mod360(planetLon) - mod360(ascLon) + 360) % 360) / 30) + 1
}

function sunGeocentricEclipticLongitude(date: Date): number {
  const v = Astronomy.GeoVector(Astronomy.Body.Sun, date, true)
  return mod360(Astronomy.Ecliptic(v).elon)
}

function geoBodyEclipticLongitude(body: Astronomy.Body, date: Date): number {
  const v = Astronomy.GeoVector(body, date, true)
  return mod360(Astronomy.Ecliptic(v).elon)
}

function isPlanetRetrograde(body: Astronomy.Body, date: Date): boolean {
  const d1 = new Date(date.getTime() + 3600000)
  const lon0 = geoBodyEclipticLongitude(body, date)
  const lon1 = geoBodyEclipticLongitude(body, d1)
  let d = lon1 - lon0
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d < 0
}

/** J2000 黄道→赤道（与 astronomy-engine HelioVector 一致） */
const J2000_OBL_DEG = 23.4392911111111

/** JPL SBDB 快照：历元 JD 2461000.5，平均运动 °/d */
const JUNO_EPOCH_JD = 2461000.5
const JUNO_N_DEG_PER_DAY = 0.226
const JUNO_E = 0.256
const JUNO_A = 2.67
const JUNO_I = 13 * RAD
const JUNO_OM = 170 * RAD
const JUNO_W = 248 * RAD
const JUNO_M0_DEG = 218

function junoHeliocentricEclipticCartesian(jd: number): { xh: number; yh: number; zh: number; r: number } {
  const n = JUNO_N_DEG_PER_DAY
  let Mdeg = JUNO_M0_DEG + n * (jd - JUNO_EPOCH_JD)
  Mdeg = mod360(Mdeg)
  let Mrad = Mdeg * RAD
  const e = JUNO_E
  let E = Mrad
  for (let i = 0; i < 12; i++) {
    E = Mrad + e * Math.sin(E)
  }
  const xv = JUNO_A * (Math.cos(E) - e)
  const yv = JUNO_A * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E)
  const v = Math.atan2(yv, xv)
  const r = JUNO_A * (1 - e * Math.cos(E))
  const u = v + JUNO_W
  const xh = r * (Math.cos(JUNO_OM) * Math.cos(u) - Math.sin(JUNO_OM) * Math.sin(u) * Math.cos(JUNO_I))
  const yh = r * (Math.sin(JUNO_OM) * Math.cos(u) + Math.cos(JUNO_OM) * Math.sin(u) * Math.cos(JUNO_I))
  const zh = r * Math.sin(u) * Math.sin(JUNO_I)
  return { xh, yh, zh, r }
}

/** 婚神地心黄道经度 */
function junoGeocentricEclipticLongitude(jd: number, astroTime: Astronomy.AstroTime): number {
  const earth = Astronomy.HelioVector(Astronomy.Body.Earth, astroTime)
  const { xh, yh, zh } = junoHeliocentricEclipticCartesian(jd)
  const obl = J2000_OBL_DEG * RAD
  const xeq = xh
  const yeq = yh * Math.cos(obl) - zh * Math.sin(obl)
  const zeq = yh * Math.sin(obl) + zh * Math.cos(obl)
  const jvec = new Astronomy.Vector(xeq, yeq, zeq, astroTime)
  const gx = jvec.x - earth.x
  const gy = jvec.y - earth.y
  const gz = jvec.z - earth.z
  const gvec = new Astronomy.Vector(gx, gy, gz, astroTime)
  return mod360(Astronomy.Ecliptic(gvec).elon)
}

/**
 * 月球真升交点黄道经度（°）：平交点 + Meeus 型主要周期项，与 Swiss 真交点接近。
 */
export function lunarTrueAscendingNodeLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868 - (T * T * T * T) / 113065000
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T * T * T) / 69699 - (T * T * T * T) / 14712000
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T - (T * T * T) / 3526000 + (T * T * T * T) / 863310000
  const Om =
    125.04452 -
    1934.136261 * T +
    0.0020708 * T * T +
    (T * T * T) / 450000 -
    (T * T * T * T) / 60616000
  const delta =
    -1.4979 * Math.sin(2 * (D - F) * RAD) -
    0.15 * Math.sin(M * RAD) -
    0.1226 * Math.sin(2 * D * RAD) -
    0.117 * Math.sin(2 * F * RAD) -
    0.0806 * Math.sin(2 * (Mp - F) * RAD) +
    0.0711 * Math.sin(Mp * RAD)
  return mod360(Om + delta)
}

function makePlanet(
  lon: number,
  planetSymbol: string,
  opts: {
    ascLon: number
    retrograde?: boolean
    forceHouse?: number
    signFullOverride?: string
    placidusHouse?: number
  },
): AstroPlanet {
  const degree = mod360(lon)
  const signFull = opts.signFullOverride ?? longitudeToSign(degree)
  const sign = signShort(signFull)
  const symbol = zodiacGlyph(signFull)
  const degreeInSign = formatDegreeInSign(degree)
  const house = opts.forceHouse ?? opts.placidusHouse ?? wholeSignHouse(degree, opts.ascLon)
  return {
    sign,
    symbol,
    degree,
    degreeInSign,
    house,
    retrograde: opts.retrograde,
    planetSymbol,
  }
}

export type AstroGeoInput = { lat: number; lon: number; tz: number }

const DEFAULT_GEO: AstroGeoInput = { lat: 39.9, lon: 116.4, tz: 8 }

export function calcAstro(
  gregorian: { year: number; month: number; day: number; hour: number; minute: number },
  geo: AstroGeoInput | null,
): AstroResult {
  const g = geo ?? DEFAULT_GEO
  const jd = julianDayFromLocalWall(
    gregorian.year,
    gregorian.month,
    gregorian.day,
    gregorian.hour,
    gregorian.minute,
    g.tz,
  )
  const date = jdUtToDate(jd)
  const astroTime = Astronomy.MakeTime(date)
  const eps = Astronomy.e_tilt(astroTime).tobl
  const gast = Astronomy.SiderealTime(date)
  const ramc = mod360(gast * 15 + g.lon)
  const { asc: ascLon, mc: mcLon, cusp } = computePlacidus(ramc, g.lat, eps)
  const ph = (lon: number) => placidusHouseForLongitude(lon, cusp)

  const solarSignFull = calcSolarSign({
    year: gregorian.year,
    month: gregorian.month,
    day: gregorian.day,
    hour: gregorian.hour,
    minute: gregorian.minute,
  }).sign

  const sunLon = sunGeocentricEclipticLongitude(date)
  const moonLon = geoBodyEclipticLongitude(Astronomy.Body.Moon, date)

  const mercury = geoBodyEclipticLongitude(Astronomy.Body.Mercury, date)
  const venus = geoBodyEclipticLongitude(Astronomy.Body.Venus, date)
  const mars = geoBodyEclipticLongitude(Astronomy.Body.Mars, date)
  const jupiter = geoBodyEclipticLongitude(Astronomy.Body.Jupiter, date)
  const saturn = geoBodyEclipticLongitude(Astronomy.Body.Saturn, date)
  const uranus = geoBodyEclipticLongitude(Astronomy.Body.Uranus, date)
  const neptune = geoBodyEclipticLongitude(Astronomy.Body.Neptune, date)
  const pluto = geoBodyEclipticLongitude(Astronomy.Body.Pluto, date)

  const nnLon = lunarTrueAscendingNodeLongitude(jd)
  const snLon = mod360(nnLon + 180)
  const junoLon = junoGeocentricEclipticLongitude(jd, astroTime)

  const sun = makePlanet(sunLon, '☉', {
    ascLon,
    retrograde: false,
    signFullOverride: solarSignFull,
    placidusHouse: ph(sunLon),
  })

  const moon = makePlanet(moonLon, '☽', { ascLon, retrograde: false, placidusHouse: ph(moonLon) })

  const ascendant = makePlanet(ascLon, 'AC', {
    ascLon,
    retrograde: false,
    forceHouse: 1,
  })

  const mc = makePlanet(mcLon, 'MC', { ascLon, retrograde: false, forceHouse: 10 })

  const northNode = makePlanet(nnLon, '\u260A', { ascLon, retrograde: true, placidusHouse: ph(nnLon) })
  const southNode = makePlanet(snLon, '\u260B', { ascLon, retrograde: true, placidusHouse: ph(snLon) })

  const junoRetro = (() => {
    const d1 = new Date(date.getTime() + 86400000)
    const jd1 = jd + 1
    const t1 = Astronomy.MakeTime(d1)
    const j0 = junoGeocentricEclipticLongitude(jd, astroTime)
    const j1 = junoGeocentricEclipticLongitude(jd1, t1)
    let dlt = j1 - j0
    if (dlt > 180) dlt -= 360
    if (dlt < -180) dlt += 360
    return dlt < 0
  })()
  const juno = makePlanet(junoLon, '\u26B5', { ascLon, retrograde: junoRetro, placidusHouse: ph(junoLon) })

  return {
    sun,
    moon,
    ascendant,
    mercury: makePlanet(mercury, '☿', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Mercury, date),
      placidusHouse: ph(mercury),
    }),
    venus: makePlanet(venus, '♀', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Venus, date),
      placidusHouse: ph(venus),
    }),
    mars: makePlanet(mars, '♂', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Mars, date),
      placidusHouse: ph(mars),
    }),
    jupiter: makePlanet(jupiter, '♃', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Jupiter, date),
      placidusHouse: ph(jupiter),
    }),
    saturn: makePlanet(saturn, '♄', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Saturn, date),
      placidusHouse: ph(saturn),
    }),
    uranus: makePlanet(uranus, '♅', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Uranus, date),
      placidusHouse: ph(uranus),
    }),
    neptune: makePlanet(neptune, '♆', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Neptune, date),
      placidusHouse: ph(neptune),
    }),
    pluto: makePlanet(pluto, '♇', {
      ascLon,
      retrograde: isPlanetRetrograde(Astronomy.Body.Pluto, date),
      placidusHouse: ph(pluto),
    }),
    northNode,
    southNode,
    mc,
    juno,
  }
}

export function signToSymbol(signName: string): string {
  return zodiacGlyph(signName)
}
