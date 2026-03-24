import type { ReactNode } from 'react'
import type { ZiweiPalaceCellData, ZiweiResult } from '../lib/mingli/ziwei'

/** 与 Step2 一致的飞星式外圈十二宫 */
const PALACE_GRID: (string | null)[][] = [
  ['夫妻', '兄弟', '命宫', '父母'],
  ['子女', null, null, '福德'],
  ['财帛', null, null, '田宅'],
  ['疾厄', '迁移', '仆役', '官禄'],
]

function resolveChartPalaceName(gridLabel: string): string {
  if (gridLabel === '交友' || gridLabel === '奴仆') return '仆役'
  return gridLabel
}

function buildPalaceMap(cells: ZiweiPalaceCellData[]): Map<string, ZiweiPalaceCellData> {
  const m = new Map<string, ZiweiPalaceCellData>()
  for (const c of cells) {
    m.set(c.name, c)
  }
  return m
}

function mutagenClass(m: string): string {
  if (m.includes('禄')) return 'bg-amber-500/90 text-black'
  if (m.includes('权')) return 'bg-emerald-600/90 text-white'
  if (m.includes('科')) return 'bg-sky-600/90 text-white'
  if (m.includes('忌')) return 'bg-rose-700/90 text-white'
  return 'bg-white/20 text-slate-100'
}

function StarLine({ stars, emphasis }: { stars: ZiweiPalaceCellData['majorStars']; emphasis: boolean }) {
  if (!stars.length) return <span className="text-slate-500/80">—</span>
  return (
    <div className="flex max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:thin]">
      {stars.map((s, i) => (
        <span key={`${s.name}-${i}`} className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
          <span className={emphasis ? 'font-semibold text-amber-100/95' : 'text-slate-200/90'}>{s.name}</span>
          {s.brightness ? (
            <span className="rounded px-0.5 text-[0.7em] leading-none text-amber-200/80 ring-[0.5px] ring-amber-400/35">
              {s.brightness}
            </span>
          ) : null}
          {s.mutagen ? (
            <span className={`rounded px-0.5 text-[0.7em] leading-none ${mutagenClass(s.mutagen)}`}>{s.mutagen}</span>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function PalaceCell({
  label,
  cell,
  isMing,
  isSurround,
  horoscope,
}: {
  label: string
  cell: ZiweiPalaceCellData | undefined
  isMing: boolean
  isSurround: boolean
  horoscope: ZiweiResult['horoscope']
}) {
  const h = cell?.heavenlyStem ?? ''
  const e = cell?.earthlyBranch ?? ''
  const [d0, d1] = cell?.decadalRange ?? [0, 0]
  const decadalLabel = cell && (d0 || d1) ? `${d0}-${d1}` : '—'

  const badges: string[] = []
  if (horoscope && cell && horoscope.yearlyIndex === cell.index) {
    badges.push(`流年·${horoscope.yearlyStem}`)
  }
  if (horoscope && cell && horoscope.monthlyIndex === cell.index) {
    badges.push(`流月·${horoscope.monthlyStem}`)
  }
  if (horoscope && cell && horoscope.decadalIndex === cell.index) {
    badges.push(`大限·${horoscope.decadalStem}`)
  }

  const minorText = cell
    ? [...cell.minorStars.map((s) => s.name), ...cell.adjectiveStars].join(' ')
    : ''

  return (
    <div
      className={`box-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-1 py-0.5 sm:px-1.5 sm:py-1 ${
        isMing
          ? 'border border-amber-400/55 bg-amber-400/[0.08]'
          : isSurround
            ? 'border border-sky-400/45 bg-sky-500/[0.07]'
            : 'border border-transparent bg-black/35'
      }`}
    >
      {badges.length > 0 ? (
        <div className="mb-0.5 flex flex-shrink-0 flex-wrap justify-end gap-0.5">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-sm bg-yellow-400/95 px-1 text-[0.65em] font-medium leading-tight text-amber-950 shadow-sm"
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-0.5 sm:gap-1">
        <div className="min-w-0 flex-1 text-[0.92em] leading-tight">
          <StarLine stars={cell?.majorStars ?? []} emphasis />
        </div>
        <div className="min-w-0 max-w-[48%] shrink-0 overflow-hidden text-right text-[0.72em] leading-tight text-slate-400/95">
          <span className="line-clamp-3 break-all">{minorText || '\u00a0'}</span>
        </div>
      </div>

      <div className="mt-auto flex min-h-0 items-end justify-between gap-0.5 border-t border-white/10 pt-0.5 text-[0.72em] leading-tight sm:gap-1 sm:pt-1">
        <div className="min-w-0 max-w-[32%] truncate text-slate-400/90">
          {cell?.changsheng12 ? <span>{cell.changsheng12}</span> : null}
          {cell?.boshi12 ? <span className="text-slate-500/80"> {cell.boshi12}</span> : null}
        </div>
        <div className="min-w-0 max-w-[36%] flex-1 px-0.5 text-center">
          <div className="truncate font-bold text-amber-100/95">{label}</div>
          <div className="truncate text-slate-400/90">{decadalLabel}</div>
          {cell?.agesShort && cell.agesShort !== '—' ? (
            <div className="truncate text-[0.85em] text-slate-500/85">小限 {cell.agesShort}</div>
          ) : null}
        </div>
        <div className="min-w-0 max-w-[30%] truncate text-right font-medium text-slate-200/90">
          {h && e ? `${h}${e}` : '—'}
        </div>
      </div>
    </div>
  )
}

export default function ZiweiChartCard({ zw }: { zw: ZiweiResult }) {
  const byName = buildPalaceMap(zw.palaceCells)
  const surround = new Set(zw.mingSurroundPalaceIndices)
  const hp = zw.horoscope

  const gridItems: ReactNode[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const name = PALACE_GRID[r][c]
      if (name === null) {
        if (r === 1 && c === 1) {
          gridItems.push(
            <div
              key="ziwei-center"
              className="flex h-full min-h-0 w-full flex-col gap-0.5 overflow-hidden bg-black/40 p-1 text-left sm:gap-1 sm:p-1.5"
              style={{ gridColumn: '2 / 4', gridRow: '2 / 4' }}
            >
              <div className="shrink-0 text-[0.95em] font-semibold leading-none text-amber-100/90">基本信息</div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-[0.78em] leading-snug text-slate-300/90">
                <div className="grid auto-rows-min grid-cols-2 content-start gap-x-1 gap-y-px [word-break:break-word]">
                  <div>
                    <span className="text-slate-500">五行局：</span>
                    {zw.header.fiveElementsClass || '—'}
                  </div>
                  {hp ? (
                    <div>
                      <span className="text-slate-500">虚岁：</span>
                      {hp.nominalAge ?? '—'}
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-500">虚岁：</span>—
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-slate-500">四柱：</span>
                    {zw.header.chineseDate || '—'}
                  </div>
                  <div>
                    <span className="text-slate-500">阳历：</span>
                    {zw.header.solarDate || '—'}
                  </div>
                  <div>
                    <span className="text-slate-500">农历：</span>
                    {zw.header.lunarDate || '—'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">时辰：</span>
                    {zw.header.time || '—'}
                    {zw.header.timeRange ? `（${zw.header.timeRange}）` : ''}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">生肖/星座：</span>
                    {zw.header.zodiac || '—'}/{zw.header.sign || '—'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">命主/身主：</span>
                    {zw.header.soul || '—'}/{zw.header.body || '—'}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">命宫主星：</span>
                    {zw.mainStar}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 pt-0.5">
                <div className="mb-px text-[0.95em] font-semibold leading-none text-amber-100/90">运限信息</div>
                {hp ? (
                  <div className="text-[0.78em] leading-tight text-slate-300/90 [word-break:break-word]">
                    <div>
                      <span className="text-slate-500">参考日：</span>
                      {hp.targetSolarDate}
                    </div>
                    <div className="text-slate-400/95">
                      限·{hp.decadalStem || '—'} 年·{hp.yearlyStem || '—'} 月·{hp.monthlyStem || '—'} 日·
                      {hp.dailyStem || '—'} 时·{hp.hourlyStem || '—'}
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.78em] text-slate-500/90">运限暂不可用</p>
                )}
              </div>
            </div>,
          )
        }
        continue
      }

      const key = resolveChartPalaceName(name)
      const cell = byName.get(key)
      const isMing = name === '命宫'
      const isSurround = cell ? surround.has(cell.index) && !isMing : false

      gridItems.push(
        <div
          key={`${r}-${c}-${name}`}
          className="relative z-0 h-full min-h-0 min-w-0"
          style={{ gridColumn: c + 1, gridRow: r + 1 }}
        >
          <PalaceCell label={name} cell={cell} isMing={isMing} isSurround={isSurround} horoscope={hp} />
        </div>,
      )
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[10px] sm:gap-x-3 sm:gap-y-1.5 sm:p-2.5 sm:text-xs">
        <div>
          <div className="text-slate-500">阳历</div>
          <div className="font-medium text-slate-100/90">{zw.header.solarDate || '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">农历</div>
          <div className="font-medium text-slate-100/90">{zw.header.lunarDate || '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">时辰</div>
          <div className="font-medium text-slate-100/90">{zw.header.time || '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">命主</div>
          <div className="font-medium text-amber-100/90">{zw.header.soul || '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">身主</div>
          <div className="font-medium text-amber-100/90">{zw.header.body || '—'}</div>
        </div>
        <div>
          <div className="text-slate-500">生肖 / 星座</div>
          <div className="font-medium text-slate-100/90">
            {zw.header.zodiac || '—'} / {zw.header.sign || '—'}
          </div>
        </div>
      </div>

      {/* 方形命盘：与上方信息卡同宽，随容器变高 */}
      <div className="w-full min-w-0 text-[clamp(6.5px,1.65vmin,11px)] leading-tight">
        <div className="aspect-square w-full min-h-0 overflow-hidden rounded-lg border border-white/10 bg-white/10">
          <div className="grid h-full min-h-0 w-full grid-cols-4 grid-rows-4 gap-px">{gridItems}</div>
        </div>
      </div>

      <p className="text-[9px] leading-snug text-slate-500/90 sm:text-[10px]">
        主星含庙旺与四化小标；右上为辅星与杂曜；下方为长生十二神、博士十二神、大限岁数区间、宫干宫支。命宫高亮，三方四正略加描边；流年/流月/大限宫以角标提示。
      </p>
    </div>
  )
}
