import { useMemo, type ReactNode } from 'react'
import BaziPanCard from '../components/BaziPanCard'
import { BaziDayunHorizontal, BaziLiuNianHorizontal } from '../components/BaziDayunLiuNianBoard'
import ZiweiChartCard from '../components/ZiweiChartCard'
import Card from '../components/Card'
import { IconBloodDrop, IconCards, IconMind, IconSparkle, IconSun } from '../components/icons'
import { lookupGeo } from '../lib/geo'
import { computeBaziContext } from '../lib/mingli/bazi'
import { buildBaziPanModel } from '../lib/mingli/baziPan'
import { computeOriginBranchRelations, computeOriginStemRelations } from '../lib/mingli/baziRelations'
import { centerLabelZh, type HdBodyRow, type HdCenterKey } from '../lib/mingli/humanDesign'
import type { AstroResult, BaziResult, ReportResults, UserInput } from '../lib/types'

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** 展示用时区标签（中国默认 Asia/Shanghai，其余用 UTC±） */
function formatTimezoneLabel(country: string | undefined, tz: number | null): string {
  if (country === '中国' || country === '中华人民共和国') return 'Asia/Shanghai'
  if (tz == null) return '—'
  const sign = tz >= 0 ? '+' : '-'
  const abs = Math.abs(tz)
  const whole = Math.floor(abs)
  const mins = Math.round((abs - whole) * 60)
  if (mins === 0) return `UTC${sign}${pad2(whole)}:00`
  return `UTC${sign}${pad2(whole)}:${pad2(mins)}`
}

/** ISO 风格本地时间 + 与 geo 一致的偏移（整点时区） */
function formatBirthLocalIsoWithOffset(input: UserInput, tz: number | null): string {
  const { year, month, day, hour, minute = 0 } = input.birth
  const core = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`
  if (tz == null) return core
  const sign = tz >= 0 ? '+' : '-'
  const abs = Math.abs(tz)
  const h = Math.floor(abs)
  const m = Math.round((abs - h) * 60)
  return `${core}${sign}${pad2(h)}:${pad2(m)}`
}

/** 左侧卡片：出生地 / 解析地点 / 时区 / 本地时间 */
function QuickChartInfoBlock({ input }: { input: UserInput }) {
  const geo = lookupGeo(input.country, input.city)
  const tz = geo?.tz ?? null
  const birthPlace =
    [input.country, input.province, input.city, input.district].filter(Boolean).join(' · ') || '—'
  const tzLabel = formatTimezoneLabel(input.country, tz)
  const localIso = formatBirthLocalIsoWithOffset(input, tz)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[11px] leading-relaxed text-slate-300/90 sm:p-3.5">
      <div className="mb-2 text-xs font-semibold text-amber-100/90">快速制图信息</div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">出生地</dt>
          <dd className="mt-0.5 text-slate-200/90">{birthPlace}</dd>
        </div>
        <div>
          <dt className="text-slate-500">解析地点</dt>
          <dd className="mt-0.5 text-slate-200/90">与出生地相同（本页计算）</dd>
        </div>
        <div>
          <dt className="text-slate-500">时区</dt>
          <dd className="mt-0.5 font-mono text-[10px] text-slate-200/90 sm:text-[11px]">{tzLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">本地时间</dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-slate-200/90 sm:text-[11px]">{localIso}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * 与 Step1「排盘系统选择」顺序一致（CHART_SYSTEM_OPTIONS 行优先：八字→…→MBTI）
 */
const STEP1_CHART_ORDER = [
  '八字',
  '紫微',
  '太阳星座',
  '生命灵数',
  '人类图',
  '吠陀',
  'MBTI',
] as const

type Step1ChartKey = (typeof STEP1_CHART_ORDER)[number]

/** 第二步展示顺序：与 Step1 可选 key 对齐，含血型/塔罗 */
const STEP2_DISPLAY_ORDER = [...STEP1_CHART_ORDER, '血型', '塔罗'] as const

const ZODIAC_RING = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] as const

/** 黄道经度 + 上升经度 → SVG 坐标（上升点在左侧） */
function lonToWheelXY(lon: number, ascDeg: number, r: number, cx: number, cy: number) {
  const delta = ((lon - ascDeg + 360) % 360) * (Math.PI / 180)
  const theta = Math.PI - delta
  return { x: cx + r * Math.cos(theta), y: cy - r * Math.sin(theta) }
}

function angularSeparationDeg(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

type AspectKind = 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile'

function classifyMajorAspect(d: number, orb: number): AspectKind | null {
  if (d <= orb) return 'conjunction'
  if (Math.abs(d - 60) <= orb) return 'sextile'
  if (Math.abs(d - 90) <= orb) return 'square'
  if (Math.abs(d - 120) <= orb) return 'trine'
  if (Math.abs(d - 180) <= orb) return 'opposition'
  return null
}

function aspectStroke(kind: AspectKind): { stroke: string; opacity: number } {
  switch (kind) {
    case 'trine':
      return { stroke: '#4ade80', opacity: 0.55 }
    case 'sextile':
      return { stroke: '#60a5fa', opacity: 0.5 }
    case 'square':
    case 'opposition':
      return { stroke: '#f87171', opacity: 0.5 }
    default:
      return { stroke: '#94a3b8', opacity: 0.45 }
  }
}

/** 与精确相位角的偏差（度），合相为实际角距 */
function aspectOrbDeviation(d: number, kind: AspectKind): number {
  const exact =
    kind === 'conjunction'
      ? 0
      : kind === 'sextile'
        ? 60
        : kind === 'square'
          ? 90
          : kind === 'trine'
            ? 120
            : 180
  return kind === 'conjunction' ? d : Math.abs(d - exact)
}

function aspectKindGlyph(kind: AspectKind): string {
  switch (kind) {
    case 'conjunction':
      return '☌'
    case 'opposition':
      return '☍'
    case 'trine':
      return '△'
    case 'square':
      return '□'
    case 'sextile':
      return '⚹'
    default:
      return '·'
  }
}

function aspectCellClass(kind: AspectKind): string {
  switch (kind) {
    case 'trine':
      return 'text-emerald-300/95'
    case 'sextile':
      return 'text-sky-300/95'
    case 'square':
    case 'opposition':
      return 'text-rose-300/95'
    default:
      return 'text-slate-300/95'
  }
}

const DEFAULT_ASPECT_ORB = 6

function WesternChartSettingsBar() {
  const items = [
    { k: '黄道', v: '回归黄道' },
    { k: '宫位制', v: '普拉西德（Swiss 算法）' },
    { k: '交点', v: '示意盘' },
    { k: '点位', v: '十大 + 升降 + 南北交 + 天顶 + 婚神' },
    { k: '相位', v: `主要相位 · 容许 ${DEFAULT_ASPECT_ORB}°` },
  ] as const
  return (
    <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[10px] text-slate-400/95 sm:text-[11px]">
      {items.map(({ k, v }) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1"
        >
          <span className="text-slate-500">{k}</span>
          <span className="text-slate-200/85">{v}</span>
        </span>
      ))}
    </div>
  )
}

/** 相位矩阵：下三角，与圆盘同一容许度 */
function AspectMatrixTable({
  astro,
  compact = false,
  showLegend = false,
  embedded = false,
}: {
  astro: AstroResult
  compact?: boolean
  showLegend?: boolean
  embedded?: boolean
}) {
  const bodies: { sym: string; short: string; lon: number }[] = [
    { sym: astro.sun.planetSymbol, short: '日', lon: astro.sun.degree },
    { sym: astro.moon.planetSymbol, short: '月', lon: astro.moon.degree },
    { sym: astro.mercury.planetSymbol, short: '水', lon: astro.mercury.degree },
    { sym: astro.venus.planetSymbol, short: '金', lon: astro.venus.degree },
    { sym: astro.mars.planetSymbol, short: '火', lon: astro.mars.degree },
    { sym: astro.jupiter.planetSymbol, short: '木', lon: astro.jupiter.degree },
    { sym: astro.saturn.planetSymbol, short: '土', lon: astro.saturn.degree },
    { sym: astro.uranus.planetSymbol, short: '天', lon: astro.uranus.degree },
    { sym: astro.neptune.planetSymbol, short: '海', lon: astro.neptune.degree },
    { sym: astro.pluto.planetSymbol, short: '冥', lon: astro.pluto.degree },
    { sym: astro.northNode.planetSymbol, short: '北交', lon: astro.northNode.degree },
    { sym: astro.southNode.planetSymbol, short: '南交', lon: astro.southNode.degree },
    { sym: astro.juno.planetSymbol, short: '婚神', lon: astro.juno.degree },
    { sym: 'AC', short: '升', lon: astro.ascendant.degree },
    { sym: 'MC', short: '天顶', lon: astro.mc.degree },
  ]

  return (
    <div
      className={
        compact ? 'mt-0 w-full min-w-0 space-y-1' : embedded ? 'mt-0 space-y-2' : 'mt-4 space-y-2'
      }
    >
      <div className={compact ? 'text-[10px] font-semibold text-amber-100/90' : 'text-xs font-semibold text-amber-100/90'}>
        相位矩阵
      </div>
      {showLegend && (
        <div
          className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.08] bg-black/15 px-2 py-2 text-[9px] text-slate-400/95 sm:gap-x-4 sm:text-[10px]"
          aria-label="相位颜色说明"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-rose-400/85" aria-hidden />
            红 · 刑 / 冲
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-emerald-400/85" aria-hidden />
            绿 · 拱
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-sky-400/85" aria-hidden />
            蓝 · 六合
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-slate-400/80" aria-hidden />
            灰 · 合
          </span>
        </div>
      )}
      <p className={compact ? 'text-[8px] leading-snug text-slate-500' : 'text-[10px] leading-4 text-slate-500'}>
        主要相位（容许 {DEFAULT_ASPECT_ORB}°）△拱 □刑 ⚹六合 ☌合 ☍冲 · 表格随容器缩放，无需横滑
      </p>
      <div className="w-full max-w-full overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:rounded-xl">
        <table
          className={`w-full table-fixed border-collapse text-center align-middle ${compact ? 'text-[clamp(7px,2.2vw,9px)]' : 'text-[clamp(7px,1.65vw,10px)]'}`}
        >
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              <th className="w-[7%] border-r border-white/10 bg-slate-900/95 p-0.5 sm:w-[6%]" />
              {bodies.map((b, j) => (
                <th
                  key={`c-${j}`}
                  className="border-l border-white/[0.06] p-0.5 font-normal text-slate-400 sm:p-1"
                  title={b.short}
                >
                  <span className="block break-words leading-none text-amber-200/80">{b.sym}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodies.map((row, i) => (
              <tr key={`r-${i}`} className="border-b border-white/[0.06] last:border-0">
                <th
                  className="w-[7%] border-r border-white/10 bg-slate-900/95 p-0.5 text-left font-normal text-slate-400 sm:w-[6%]"
                  title={row.short}
                >
                  <span className="block break-words leading-none text-amber-200/80">{row.sym}</span>
                </th>
                {bodies.map((_, j) => {
                  if (j >= i) {
                    return (
                      <td
                        key={`${i}-${j}`}
                        className={`border-l border-white/[0.06] bg-white/[0.02] p-0.5 text-slate-600 sm:p-1 ${compact ? 'text-[8px]' : ''}`}
                      >
                        {j === i ? '·' : '—'}
                      </td>
                    )
                  }
                  const d = angularSeparationDeg(row.lon, bodies[j].lon)
                  const kind = classifyMajorAspect(d, DEFAULT_ASPECT_ORB)
                  if (!kind) {
                    return (
                      <td
                        key={`${i}-${j}`}
                        className="border-l border-white/[0.06] p-0.5 text-slate-600 sm:p-1"
                      />
                    )
                  }
                  const orb = aspectOrbDeviation(d, kind)
                  return (
                    <td
                      key={`${i}-${j}`}
                      className={`border-l border-white/[0.06] bg-white/[0.03] p-0.5 font-medium leading-tight sm:p-1 ${aspectCellClass(kind)}`}
                    >
                      <span className="block text-[1em] leading-none">{aspectKindGlyph(kind)}</span>
                      <span className="block text-[0.85em] leading-tight text-slate-400/90">{orb.toFixed(1)}°</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 本命盘示意：整宫 + 主要相位线（容许度约 6°） */
function NatalWheelPreview({ astro, compact = false }: { astro: AstroResult; compact?: boolean }) {
  const cx = 150
  const cy = 150
  const rOuter = 138
  const rInner = 92
  const rPlanet = 114
  const rAspect = 78
  const ascDeg = astro.ascendant.degree
  const orb = DEFAULT_ASPECT_ORB

  const aspectBodies: { lon: number }[] = [
    { lon: astro.sun.degree },
    { lon: astro.moon.degree },
    { lon: astro.mercury.degree },
    { lon: astro.venus.degree },
    { lon: astro.mars.degree },
    { lon: astro.jupiter.degree },
    { lon: astro.saturn.degree },
    { lon: astro.uranus.degree },
    { lon: astro.neptune.degree },
    { lon: astro.pluto.degree },
    { lon: astro.northNode.degree },
    { lon: astro.southNode.degree },
    { lon: astro.juno.degree },
    { lon: astro.ascendant.degree },
    { lon: astro.mc.degree },
  ]

  const aspectSegments: { x1: number; y1: number; x2: number; y2: number; kind: AspectKind }[] = []
  for (let i = 0; i < aspectBodies.length; i++) {
    for (let j = i + 1; j < aspectBodies.length; j++) {
      const d = angularSeparationDeg(aspectBodies[i].lon, aspectBodies[j].lon)
      const kind = classifyMajorAspect(d, orb)
      if (!kind) continue
      const a = lonToWheelXY(aspectBodies[i].lon, ascDeg, rAspect, cx, cy)
      const b = lonToWheelXY(aspectBodies[j].lon, ascDeg, rAspect, cx, cy)
      aspectSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind })
    }
  }

  const rAux = compact ? 102 : 104
  const planets: { lon: number; sym: string; label: string; r?: number; fs?: number }[] = [
    { lon: astro.sun.degree, sym: astro.sun.planetSymbol, label: '日' },
    { lon: astro.moon.degree, sym: astro.moon.planetSymbol, label: '月' },
    { lon: astro.ascendant.degree, sym: 'AC', label: '升' },
    { lon: astro.mc.degree, sym: 'MC', label: '', r: rAux, fs: compact ? 9 : 10 },
    { lon: astro.northNode.degree, sym: astro.northNode.planetSymbol, label: '', r: rAux, fs: compact ? 11 : 12 },
    { lon: astro.southNode.degree, sym: astro.southNode.planetSymbol, label: '', r: rAux, fs: compact ? 11 : 12 },
    { lon: astro.juno.degree, sym: astro.juno.planetSymbol, label: '', r: rAux, fs: compact ? 10 : 11 },
    { lon: astro.mercury.degree, sym: astro.mercury.planetSymbol, label: '' },
    { lon: astro.venus.degree, sym: astro.venus.planetSymbol, label: '' },
    { lon: astro.mars.degree, sym: astro.mars.planetSymbol, label: '' },
    { lon: astro.jupiter.degree, sym: astro.jupiter.planetSymbol, label: '' },
    { lon: astro.saturn.degree, sym: astro.saturn.planetSymbol, label: '' },
    { lon: astro.uranus.degree, sym: astro.uranus.planetSymbol, label: '' },
    { lon: astro.neptune.degree, sym: astro.neptune.planetSymbol, label: '' },
    { lon: astro.pluto.degree, sym: astro.pluto.planetSymbol, label: '' },
  ]

  return (
    <div
      className={`mx-auto w-full ${compact ? 'max-w-[188px]' : 'mb-4 max-w-[300px]'} sm:mx-0`}
    >
      <svg viewBox="0 0 300 300" className="h-auto w-full text-slate-200/90" aria-hidden>
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={rInner} fill="rgba(255,255,255,0.03)" stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
        {aspectSegments.map((seg, idx) => {
          const { stroke, opacity } = aspectStroke(seg.kind)
          return (
            <line
              key={`asp-${idx}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={stroke}
              strokeOpacity={opacity}
              strokeWidth={compact ? 1 : 1.25}
            />
          )
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const cusp = ascDeg + i * 30
          const p1 = lonToWheelXY(cusp, ascDeg, rInner, cx, cy)
          const p2 = lonToWheelXY(cusp, ascDeg, rOuter, cx, cy)
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          )
        })}
        {ZODIAC_RING.map((glyph, i) => {
          const midLon = i * 30 + 15
          const { x, y } = lonToWheelXY(midLon, ascDeg, (rOuter + rInner) / 2, cx, cy)
          return (
            <text
              key={glyph}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-amber-200/70 text-[13px]"
              style={{ fontSize: 13 }}
            >
              {glyph}
            </text>
          )
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const mid = ascDeg + i * 30 + 15
          const { x, y } = lonToWheelXY(mid, ascDeg, (rInner + 48) / 2, cx, cy)
          return (
            <text
              key={`h-${i + 1}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400/80"
              style={{ fontSize: 10 }}
            >
              {i + 1}
            </text>
          )
        })}
        {planets.map((pl, idx) => {
          const r = pl.r ?? rPlanet
          const { x, y } = lonToWheelXY(pl.lon, ascDeg, r, cx, cy)
          const fs = pl.fs ?? (pl.sym === 'AC' ? 11 : 13)
          return (
            <text
              key={`${pl.sym}-${idx}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-amber-100/90"
              style={{ fontSize: fs }}
            >
              {pl.label || pl.sym}
            </text>
          )
        })}
      </svg>
      <p
        className={`mt-1.5 text-center leading-snug text-slate-500 ${compact ? 'text-[8px]' : 'mt-2 text-[10px] leading-4'}`}
      >
        {compact
          ? '整宫制示意 · 彩色为相位线'
          : '外圈为整宫示意；列表宫位为普拉西德。行星历元 astronomy-engine；婚神为轨道根数近似。'}
      </p>
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full bg-white/10 my-3" />
}

/** 五行英文强度标签（参考移动端常见分档） */
function wuxingStrengthEn(percent: number): string {
  if (percent === 0) return 'Very Weak'
  if (percent >= 27) return 'Strong'
  if (percent >= 15) return 'Moderate'
  return 'Weak'
}

const WUXING_CARD: Record<
  '木' | '火' | '土' | '金' | '水',
  { wrap: string; accent: string }
> = {
  木: {
    wrap: 'border-emerald-500/35 bg-emerald-950/75 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]',
    accent: 'text-emerald-200',
  },
  火: {
    wrap: 'border-rose-500/35 bg-red-950/70 shadow-[inset_0_1px_0_rgba(251,113,133,0.12)]',
    accent: 'text-rose-200',
  },
  土: {
    wrap: 'border-amber-600/40 bg-amber-950/65 shadow-[inset_0_1px_0_rgba(245,158,11,0.1)]',
    accent: 'text-amber-200',
  },
  金: {
    wrap: 'border-yellow-600/35 bg-yellow-950/50 shadow-[inset_0_1px_0_rgba(250,204,21,0.1)]',
    accent: 'text-yellow-100',
  },
  水: {
    wrap: 'border-sky-600/40 bg-slate-950/90 shadow-[inset_0_1px_0_rgba(56,189,248,0.1)]',
    accent: 'text-sky-200',
  },
}

function BaziDayMasterBlock({ dm }: { dm: NonNullable<BaziResult['dayMaster']> }) {
  const pill =
    dm.element === '木'
      ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100'
      : dm.element === '火'
        ? 'border-rose-400/50 bg-rose-500/20 text-rose-100'
        : dm.element === '土'
          ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
          : dm.element === '金'
            ? 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100'
            : 'border-sky-400/50 bg-sky-600/25 text-sky-100'

  const iconBox =
    dm.element === '木'
      ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
      : dm.element === '火'
        ? 'border-rose-400/35 bg-rose-500/15 text-rose-200'
        : dm.element === '土'
          ? 'border-amber-400/35 bg-amber-500/15 text-amber-200'
          : dm.element === '金'
            ? 'border-yellow-400/35 bg-yellow-500/15 text-yellow-100'
            : 'border-sky-400/35 bg-sky-600/25 text-sky-200'

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${iconBox}`}>
          <IconSparkle className="h-5 w-5" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">日主</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${pill}`}>
            {dm.traitEn}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-300/95">
        <span className="font-medium text-amber-100/90">{dm.label}</span>
        {' · '}
        {dm.oneLiner}
      </p>
    </div>
  )
}

function BaziChengGuBlock({ cg }: { cg: BaziResult['chengGu'] }) {
  return (
    <div className="rounded-xl border border-amber-400/25 bg-black/25 p-4">
      <div className="mb-3 flex items-center gap-2 text-amber-200/95">
        <span className="text-lg" aria-hidden>
          ⚖️
        </span>
        <span className="text-sm font-semibold tracking-wide">称骨算命</span>
        <span className="text-[10px] text-slate-500">（袁天罡称骨歌 · 表文仅供参考）</span>
      </div>
      <div className="mb-4 flex justify-center">
        <span className="rounded-full border border-amber-400/40 bg-amber-950/40 px-4 py-1.5 text-xs font-semibold tracking-wide text-amber-200">
          称骨重量：{cg.weightLabel}
        </span>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-center">
        <p className="text-sm leading-7 text-amber-100/90">{cg.poem}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-400/95">{cg.summary}</p>
      </div>
    </div>
  )
}

function WuxingEnergyCards({ elements }: { elements: BaziResult['elements'] }) {
  const maxEl = elements.reduce((a, b) => (b.percent > a.percent ? b : a))
  const minEl = elements.reduce((a, b) => (b.percent < a.percent ? b : a))

  return (
    <div className="rounded-xl border border-amber-400/25 bg-black/25 p-4">
      <div className="mb-3 text-center text-sm font-semibold tracking-wide text-amber-200/90">五行能量分布</div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pb-0.5">
        {elements.map((el) => {
          const st = WUXING_CARD[el.element]
          const en = wuxingStrengthEn(el.percent)
          return (
            <div
              key={el.element}
              className={`flex min-h-[5.5rem] flex-col items-center justify-between rounded-lg border px-1 py-2.5 text-center sm:min-h-[6rem] sm:px-1.5 ${st.wrap}`}
            >
              <div className={`text-[11px] font-semibold tabular-nums sm:text-xs ${st.accent}`}>{el.percent.toFixed(1)}%</div>
              <div className={`text-base font-bold sm:text-lg ${st.accent}`}>{el.element}</div>
              <div className="text-[9px] leading-tight text-slate-300/85 sm:text-[10px]">{en}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-8 flex justify-center gap-14 pt-0.5 sm:gap-16">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] leading-none text-slate-500">最旺</span>
          <span className="text-sm font-semibold leading-none text-amber-200/95">{maxEl.element}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] leading-none text-slate-500">待补</span>
          <span className="text-sm font-semibold leading-none text-violet-300/95">{minEl.element}</span>
        </div>
      </div>
    </div>
  )
}

/** 各体系详细排盘（八字盘、紫微格、星盘等），供结果页嵌入 */
export function Step2ChartsSection({
  input,
  results,
}: {
  input: UserInput
  results: ReportResults
}) {
  /**
   * 仅展示第 1 步已勾选的排盘系统。
   * 未传 selectedChartSystems 时：兼容旧数据，但不展示「塔罗」「血型」（须显式勾选）。
   */
  const displayOrder = useMemo(() => {
    const sel = input.selectedChartSystems
    if (sel && sel.length > 0) {
      return STEP2_DISPLAY_ORDER.filter((k) => sel.includes(k))
    }
    return STEP2_DISPLAY_ORDER.filter((k) => k !== '塔罗' && k !== '血型')
  }, [input.selectedChartSystems])

  const baziPan = useMemo(() => {
    const ctx = computeBaziContext(input.birth, input.calendarType ?? '公历', {
      country: input.country,
      province: input.province,
      city: input.city,
      district: input.district,
      useSolarTime: input.useSolarTime,
    })
    return buildBaziPanModel(ctx, input.name, input.gender)
  }, [input])

  const renderSystem = (sysKey: string): ReactNode => {
    switch (sysKey as Step1ChartKey | '血型' | '塔罗') {
      case '八字':
        {
          const stemRelations = computeOriginStemRelations(baziPan.columns.map((c) => c.stem))
          const branchRelations = computeOriginBranchRelations(baziPan.columns.map((c) => c.branch))

        return (
          <div key={sysKey} className="mx-auto w-full max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-amber-400/25 bg-white/5 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06),0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <BaziPanCard model={baziPan} embedded />
              <div className="space-y-3 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-6 text-slate-100/85 sm:p-4">
                  <div className="space-y-1">
                    <div>
                      <span className="text-slate-400">原局天干：</span>
                      <span className="text-slate-200/90">
                        {stemRelations.length ? stemRelations.join('，') : '未见明显合冲'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">原局地支：</span>
                      <span className="text-slate-200/90">
                        {branchRelations.length ? branchRelations.join('，') : '未见明显三合六合刑冲克害'}
                      </span>
                    </div>
                  </div>
                </div>
                {results.bazi.dayMaster ? <BaziDayMasterBlock dm={results.bazi.dayMaster} /> : null}
                <BaziChengGuBlock cg={results.bazi.chengGu} />
                <WuxingEnergyCards elements={results.bazi.elements} />
                {results.bazi.dayun?.rows?.length ? (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs leading-6 text-slate-100/85">
                    <div className="mb-2 font-medium text-amber-200/90">大运（十年一步）</div>
                    <div className="mb-2 text-slate-300/90">{results.bazi.dayun.qiYunText}</div>
                    <div className="mb-3 text-[11px] text-slate-400">
                      顺逆：{results.bazi.dayun.isForward ? '顺排' : '逆排'}；干支由月柱起算，与排盘表月柱一致。横排从左到右为童限（小运）→
                      各步大运；每列自上而下为：年份、虚岁、柱位（童限为「小运」，大运为大运干支）。金色描边为当前公历年所在大运。
                    </div>
                    <BaziDayunHorizontal dayun={results.bazi.dayun} />
                    <div className="mb-2 mt-5 font-medium text-amber-200/90">流年（立春换年）</div>
                    <div className="mb-3 text-[11px] text-slate-400">
                      以本机当前公历年为中心前后各 5 年；每列：年份、虚岁、流年干支。金色描边为当前流年。
                    </div>
                    <BaziLiuNianHorizontal birthYear={input.birth.year} />
                  </div>
                ) : null}
                <div className="rounded-xl border border-amber-400/20 bg-white/5 p-3 text-xs leading-6 text-slate-100/80">
                  注：四柱/节气换年使用 `lunar-javascript` 计算；五行分布为基于干支主气映射的统计展示。
                </div>
              </div>
            </div>
          </div>
        )
        }

      case '紫微':
        if (!results.ziwei) return null
        return (
          <Card key={sysKey} icon={<IconSparkle className="h-6 w-6" />} title="紫微斗数">
            <ZiweiChartCard zw={results.ziwei} />
          </Card>
        )

      case '太阳星座':
        return (
          <Card key={sysKey} icon={<IconSun className="h-6 w-6" />} title="西洋本命星盘">
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-100/90">太阳星座</div>
              <div className="text-sm text-amber-100/90">
                {results.solar.sign}（{results.solar.range}）
              </div>
              <Divider />
              <div className="text-sm leading-6 text-slate-100/85">{results.solar.traits}</div>
            </div>
            {results.astro && (
              <>
                <Divider />
                <WesternChartSettingsBar />
                <p className="mb-3 text-xs leading-5 text-slate-400">
                  行星与日月为地心黄道（astronomy-engine）；上升/天顶/宫位为 GAST + 真黄赤交角 + Swiss 式普拉西德；时间取
                  <strong className="text-amber-200/90">出生地墙钟</strong>
                  （与八字真太阳时无关）。圆盘外圈仍为整宫示意；婚神为 JPL 根数近似，可能与 Swiss 差少量分。
                </p>
                <div className="mb-3 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-5">
                  <div className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-sm sm:p-4">
                    <QuickChartInfoBlock input={input} />
                    <div className="mt-4 flex flex-1 items-center justify-center">
                      <NatalWheelPreview astro={results.astro} compact={false} />
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                    <AspectMatrixTable astro={results.astro} compact={false} showLegend embedded />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {(
                    [
                      { label: '太阳', key: 'sun' },
                      { label: '月亮', key: 'moon' },
                      { label: '上升', key: 'ascendant' },
                      { label: '天顶', key: 'mc' },
                      { label: '北交点', key: 'northNode' },
                      { label: '南交点', key: 'southNode' },
                      { label: '婚神', key: 'juno' },
                      { label: '水星', key: 'mercury' },
                      { label: '金星', key: 'venus' },
                      { label: '火星', key: 'mars' },
                      { label: '木星', key: 'jupiter' },
                      { label: '土星', key: 'saturn' },
                      { label: '天王星', key: 'uranus' },
                      { label: '海王星', key: 'neptune' },
                      { label: '冥王星', key: 'pluto' },
                    ] as const
                  ).map(({ label, key: planetKey }) => {
                    const p = results.astro![planetKey]
                    return (
                      <div
                        key={planetKey}
                        className="relative rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="pr-10 text-sm font-semibold text-amber-100">
                          {label}{' '}
                          <span className="font-normal">-</span>{' '}
                          <span className="text-amber-400">{p.sign}</span>
                          <span className="text-amber-300">{p.symbol}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-300/70">
                          H{p.house ?? '—'} · {p.degreeInSign}
                          {p.retrograde ? <span className="text-red-400/80"> 逆行</span> : null}
                        </div>
                        <div className="absolute top-3 right-3 text-lg text-slate-300/50">{p.planetSymbol}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        )

      case '生命灵数':
        return (
          <Card key={sysKey} icon={<IconSparkle className="h-6 w-6" />} title="生命数字（生命灵数）">
            <div className="space-y-2">
              <div className="text-sm text-amber-100/90">
                主命数：{results.lifeNumber.number}（{results.lifeNumber.title}）
              </div>
              <Divider />
              <div>{results.lifeNumber.interpretation}</div>
            </div>
          </Card>
        )

      case '人类图': {
        const hd = results.humanDesign
        const ALL: HdCenterKey[] = ['head', 'ajna', 'throat', 'g', 'ego', 'solar', 'sacral', 'spleen', 'root']
        const definedSet = new Set(hd.definedCenters)
        const openCenters = ALL.filter((c) => !definedSet.has(c))
        const gl = (r: HdBodyRow) => `${r.gate}.${r.line}`
        const rows = (side: typeof hd.personality) =>
          [
            side.sun,
            side.earth,
            side.moon,
            side.northNode,
            side.southNode,
            side.mercury,
            side.venus,
            side.mars,
            side.jupiter,
            side.saturn,
            side.uranus,
            side.neptune,
            side.pluto,
          ] as HdBodyRow[]
        return (
          <Card key={sysKey} icon={<IconSparkle className="h-6 w-6" />} title="人类图（BodyGraph）">
            <div className="space-y-5 text-sm leading-6 text-slate-200/90">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="text-xs font-semibold text-amber-200/80">能量类型</div>
                  <div className="mt-1 text-lg font-semibold text-amber-100">{hd.type}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-slate-400">人生角色（Profile）</div>
                  <div className="mt-1 text-lg font-semibold text-amber-100">{hd.profile}</div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-400">策略</div>
                <div className="mt-1">{hd.strategy}</div>
                <div className="mt-3 text-xs text-slate-400">内在权威</div>
                <div className="mt-1">{hd.authority}</div>
              </div>
              <div className="text-xs text-slate-400">
                设计时刻（UTC，太阳相对出生逆行约 88°）：{' '}
                <span className="font-mono text-slate-200/90">{hd.designTimeIso.replace('T', ' ').slice(0, 19)}</span>
              </div>
              <Divider />
              <div className="text-xs font-semibold text-amber-100/90">个性（黑色 · 出生时刻）</div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[280px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-3 py-2 font-medium">天体</th>
                      <th className="px-3 py-2 font-medium">黄道经度°</th>
                      <th className="px-3 py-2 font-medium">闸门·爻</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows(hd.personality).map((r) => (
                      <tr key={`p-${r.key}`} className="border-b border-white/5">
                        <td className="px-3 py-2 text-slate-200">{r.label}</td>
                        <td className="px-3 py-2 font-mono text-slate-300/90">{r.lonDeg.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-amber-100/90">{gl(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs font-semibold text-amber-100/90">设计（红色 · 设计时刻）</div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[280px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="px-3 py-2 font-medium">天体</th>
                      <th className="px-3 py-2 font-medium">黄道经度°</th>
                      <th className="px-3 py-2 font-medium">闸门·爻</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows(hd.design).map((r) => (
                      <tr key={`d-${r.key}`} className="border-b border-white/5">
                        <td className="px-3 py-2 text-slate-200">{r.label}</td>
                        <td className="px-3 py-2 font-mono text-slate-300/90">{r.lonDeg.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-amber-100/90">{gl(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Divider />
              <div className="text-xs font-semibold text-amber-100/90">已接通通道（{hd.activeChannels.length}）</div>
              {hd.activeChannels.length === 0 ? (
                <div className="text-xs text-slate-400">当前计算下无完整通道接通（反映者或极少定义）。</div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {hd.activeChannels.map((ch) => (
                    <li
                      key={`${ch.a}-${ch.b}`}
                      className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100/90"
                    >
                      {ch.a}-{ch.b} {ch.nameZh}
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-emerald-200/80">有定义中心</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hd.definedCenters.length === 0 ? (
                      <span className="text-xs text-slate-500">无</span>
                    ) : (
                      hd.definedCenters.map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100/90"
                        >
                          {centerLabelZh(c)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">未定义中心</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {openCenters.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400"
                      >
                        {centerLabelZh(c)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                闸门映射参考开源 hdkit 算法；通道与类型/权威为程序根据接通关系推导。若与商业排盘有出入，以你常用的专业软件为准。
              </p>
            </div>
          </Card>
        )
      }

      case '吠陀':
        return (
          <Card key={sysKey} icon={<IconSparkle className="h-6 w-6" />} title="吠陀占星">
            <div className="py-4 text-center text-sm text-slate-300/60">吠陀占星模块开发中</div>
          </Card>
        )

      case 'MBTI':
        return (
          <Card key={sysKey} icon={<IconMind className="h-6 w-6" />} title="MBTI">
            <div className="space-y-2">
              <div className="text-sm text-amber-100/90">
                {results.mbti.mbti}（{results.mbti.title}）
              </div>
              <Divider />
              <div>{results.mbti.interpretation}</div>
            </div>
          </Card>
        )

      case '血型':
        return (
          <Card key={sysKey} icon={<IconBloodDrop className="h-6 w-6" />} title="血型性格">
            <div className="space-y-2">
              <div className="text-sm text-amber-100/90">
                {results.blood.bloodType} 型血（{results.blood.title}）
              </div>
              <Divider />
              <div>{results.blood.interpretation}</div>
            </div>
          </Card>
        )

      case '塔罗':
        return (
          <Card key={sysKey} icon={<IconCards className="h-6 w-6" />} title="塔罗（大阿卡纳随机抽取）">
            <div className="space-y-4">
              <div className="text-xs text-slate-200/80">基于你的输入做稳定随机：过去 / 现在 / 未来</div>
              <div className="grid gap-3">
                {results.tarot.picks.map((p) => (
                  <div key={p.position} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-amber-100">{p.position}</div>
                      <div className="text-xs text-slate-200/80">No.{p.card.id}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-100/90">{p.card.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.card.keywords.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100/90"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-xs leading-6 text-slate-100/80">{p.card.meaningUpright}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {displayOrder.map((key) => renderSystem(key))}
    </div>
  )
}
