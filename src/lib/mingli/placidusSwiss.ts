/**
 * 普拉西德宫位 + 上升/天顶：自 Swiss Ephemeris swehouse.c 摘译（Asc1/Asc2、默认 Placidus）。
 * cusp[0]..cusp[11] = 第1..12宫起点黄道经度。
 */

const RAD = Math.PI / 180
const VERY_SMALL = 1e-12
const VERY_SMALL_PLAC_ITER = 1e-8
const NITER_MAX = 100

function degnorm(x: number): number {
  let y = x % 360
  if (y < 0) y += 360
  return y
}

function difdeg2n(a: number, b: number): number {
  let d = degnorm(a - b)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

const sind = (d: number) => Math.sin(d * RAD)
const cosd = (d: number) => Math.cos(d * RAD)
const tand = (d: number) => Math.tan(d * RAD)
const asind = (x: number) => (Math.asin(Math.min(1, Math.max(-1, x))) / RAD)
const atand = (x: number) => (Math.atan(x) / RAD)

function asc2(x: number, f: number, sine: number, cose: number): number {
  let ass = -tand(f) * sine + cose * cosd(x)
  if (Math.abs(ass) < VERY_SMALL) ass = 0
  let sinx = sind(x)
  if (Math.abs(sinx) < VERY_SMALL) sinx = 0
  if (sinx === 0) {
    ass = ass < 0 ? -VERY_SMALL : VERY_SMALL
  } else if (ass === 0) {
    ass = sinx < 0 ? -90 : 90
  } else {
    ass = atand(sinx / ass)
  }
  if (ass < 0) ass += 180
  return ass
}

function asc1(x1: number, f: number, sine: number, cose: number): number {
  x1 = degnorm(x1)
  const n = Math.floor(x1 / 90) + 1
  if (Math.abs(90 - f) < VERY_SMALL) return 180
  if (Math.abs(90 + f) < VERY_SMALL) return 0
  let ass: number
  if (n === 1) ass = asc2(x1, f, sine, cose)
  else if (n === 2) ass = 180 - asc2(180 - x1, -f, sine, cose)
  else if (n === 3) ass = 180 + asc2(x1 - 180, -f, sine, cose)
  else ass = 360 - asc2(360 - x1, f, sine, cose)
  ass = degnorm(ass)
  if (Math.abs(ass - 90) < VERY_SMALL) ass = 90
  if (Math.abs(ass - 180) < VERY_SMALL) ass = 180
  if (Math.abs(ass - 270) < VERY_SMALL) ass = 270
  if (Math.abs(ass - 360) < VERY_SMALL) ass = 0
  return ass
}

export function mcFromRamc(th: number, _epsDeg: number, cose: number): number {
  if (Math.abs(th - 90) > VERY_SMALL && Math.abs(th - 270) > VERY_SMALL) {
    let mc = atand(tand(th) / cose)
    if (th > 90 && th <= 270) mc = degnorm(mc + 180)
    return degnorm(mc)
  }
  return Math.abs(th - 90) <= VERY_SMALL ? 90 : 270
}

export function ascendantFromRamc(th: number, fi: number, epsDeg: number): number {
  const sine = sind(epsDeg)
  const cose = cosd(epsDeg)
  return asc1(degnorm(th + 90), fi, sine, cose)
}

function placidusIterCusp(
  rectasc: number,
  div: number,
  fh: number,
  _fi: number,
  sine: number,
  cose: number,
  tanfi: number,
): number {
  let tant = tand(asind(sine * sind(asc1(rectasc, fh, sine, cose))))
  if (Math.abs(tant) < VERY_SMALL) return rectasc
  let f = atand(sind(asind(tanfi * tant) / div) / tant)
  let cusp = asc1(rectasc, f, sine, cose)
  let cuspsv = 0
  for (let i = 1; i <= NITER_MAX; i++) {
    tant = tand(asind(sine * sind(cusp)))
    if (Math.abs(tant) < VERY_SMALL) return rectasc
    f = atand(sind(asind(tanfi * tant) / div) / tant)
    cusp = asc1(rectasc, f, sine, cose)
    if (i > 1 && Math.abs(difdeg2n(cusp, cuspsv)) < VERY_SMALL_PLAC_ITER) break
    cuspsv = cusp
  }
  return cusp
}

export type PlacidusResult = {
  asc: number
  mc: number
  cusp: number[]
}

/**
 * @param ramcDeg RAMC（度）= 格林尼治视恒星时(时)×15 + 东经
 * @param latDeg 北纬为正
 */
export function computePlacidus(ramcDeg: number, latDeg: number, epsDeg: number): PlacidusResult {
  const th = degnorm(ramcDeg)
  let fi = latDeg
  const ekl = epsDeg
  if (Math.abs(Math.abs(fi) - 90) < VERY_SMALL) {
    fi = fi < 0 ? -90 + VERY_SMALL : 90 - VERY_SMALL
  }
  const sine = sind(ekl)
  const cose = cosd(ekl)
  const tane = tand(ekl)
  const tanfi = tand(fi)

  const mc = mcFromRamc(th, ekl, cose)
  const ac = ascendantFromRamc(th, fi, ekl)

  const cusp = new Array<number>(12)

  /* 近极区：简易 Porphyry 四分 */
  if (Math.abs(fi) >= 90 - ekl) {
    const acmc = difdeg2n(ac, mc)
    const q = acmc < 0 ? 180 + acmc : acmc
    const s = q / 3
    cusp[0] = ac
    cusp[1] = degnorm(ac + s)
    cusp[2] = degnorm(ac + 2 * s)
    cusp[3] = degnorm(mc + 180)
    cusp[4] = degnorm(cusp[3] + s)
    cusp[5] = degnorm(cusp[3] + 2 * s)
    cusp[6] = degnorm(ac + 180)
    cusp[7] = degnorm(cusp[6] + s)
    cusp[8] = degnorm(cusp[6] + 2 * s)
    cusp[9] = mc
    cusp[10] = degnorm(mc + s)
    cusp[11] = degnorm(mc + 2 * s)
    return { asc: ac, mc, cusp }
  }

  const a = asind(tanfi * tane)
  const fh1 = atand(sind(a / 3) / tane)
  const fh2 = atand(sind((a * 2) / 3) / tane)

  /* Swiss: 先算 11、12、2、3 宫，再用对宫填 4–9 */
  const sw11 = placidusIterCusp(degnorm(30 + th), 3, fh1, fi, sine, cose, tanfi)
  const sw12 = placidusIterCusp(degnorm(60 + th), 1.5, fh2, fi, sine, cose, tanfi)
  const sw2 = placidusIterCusp(degnorm(120 + th), 1.5, fh2, fi, sine, cose, tanfi)
  const sw3 = placidusIterCusp(degnorm(150 + th), 3, fh1, fi, sine, cose, tanfi)

  /* Swiss：先填 11、12、2、3，再用对宫关系填 4–9，1=Asc、10=MC 保持 */
  cusp[0] = ac
  cusp[1] = sw2
  cusp[2] = sw3
  cusp[3] = degnorm(mc + 180)
  cusp[4] = degnorm(sw11 + 180)
  cusp[5] = degnorm(sw12 + 180)
  cusp[6] = degnorm(ac + 180)
  cusp[7] = degnorm(sw2 + 180)
  cusp[8] = degnorm(sw3 + 180)
  cusp[9] = mc
  cusp[10] = sw11
  cusp[11] = sw12

  return { asc: ac, mc, cusp }
}

/** 普拉西德：黄道经度所在宫位（1–12） */
export function placidusHouseForLongitude(lon: number, cusp: number[]): number {
  const L = degnorm(lon)
  for (let h = 0; h < 12; h++) {
    const a = degnorm(cusp[h])
    const b = degnorm(cusp[(h + 1) % 12])
    const span = (b - a + 360) % 360
    const d = (L - a + 360) % 360
    if (span > 0 && d < span) return h + 1
  }
  return 1
}
