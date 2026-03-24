import { useMemo } from 'react'
import type { BaziDayunBundle } from '../lib/mingli/baziDayun'
import { buildLiuNianFlow } from '../lib/mingli/baziDayun'

function formatYearRange(a: number, b: number) {
  if (a === b) return `${a}年`
  return `${a}–${b}年`
}

function formatAgeRange(a: number, b: number) {
  if (a === b) return `${a}岁`
  return `${a}–${b}岁`
}

function FlowCell({
  top,
  mid,
  bot,
  active,
  narrow,
}: {
  top: string
  mid: string
  bot: string
  active: boolean
  narrow?: boolean
}) {
  return (
    <div
      className={[
        'flex shrink-0 flex-col items-center justify-between rounded-lg border px-1 py-2 text-center',
        narrow ? 'w-[3.35rem]' : 'w-[4.35rem]',
        active
          ? 'border-amber-400/75 bg-amber-400/[0.14] shadow-[0_0_0_0.5px_rgba(251,191,36,0.35)]'
          : 'border-white/10 bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="min-h-[2rem] w-full text-[10px] leading-tight text-slate-200/90">{top}</div>
      <div className="my-1 min-h-[1.25rem] w-full text-[10px] leading-tight text-slate-400/90">{mid}</div>
      <div className="min-h-[1.25rem] w-full text-[11px] font-semibold leading-tight text-amber-100/95">{bot}</div>
    </div>
  )
}

/** 大运：横排，每列上=年份区间、中=虚岁区间、下=小运或大运干支；高亮当前公历年所在柱 */
export function BaziDayunHorizontal({ dayun }: { dayun: BaziDayunBundle }) {
  const currentYear = new Date().getFullYear()

  const columns = useMemo(() => {
    const cols: {
      key: string
      top: string
      mid: string
      bot: string
      active: boolean
    }[] = []
    if (dayun.tong) {
      const t = dayun.tong
      cols.push({
        key: 'tong',
        top: formatYearRange(t.startYear, t.endYear),
        mid: formatAgeRange(t.startAge, t.endAge),
        bot: '小运',
        active: currentYear >= t.startYear && currentYear <= t.endYear,
      })
    }
    for (const r of dayun.rows) {
      cols.push({
        key: `dy-${r.step}`,
        top: formatYearRange(r.startYear, r.endYear),
        mid: formatAgeRange(r.startAge, r.endAge),
        bot: r.ganZhi,
        active: currentYear >= r.startYear && currentYear <= r.endYear,
      })
    }
    return cols
  }, [dayun, currentYear])

  return (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
      <div className="flex min-w-max gap-1.5">
        {columns.map((c) => (
          <FlowCell key={c.key} top={c.top} mid={c.mid} bot={c.bot} active={c.active} />
        ))}
      </div>
    </div>
  )
}

/** 流年：横排，每列上=公历年、中=虚岁、下=流年干支（立春换年）；高亮当前年 */
export function BaziLiuNianHorizontal({ birthYear }: { birthYear: number }) {
  const currentYear = new Date().getFullYear()
  const columns = useMemo(
    () => buildLiuNianFlow(birthYear, currentYear, 5, 5),
    [birthYear, currentYear],
  )

  return (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
      <div className="flex min-w-max gap-1.5">
        {columns.map((ln) => (
          <FlowCell
            key={ln.year}
            top={`${ln.year}年`}
            mid={`${ln.age}岁`}
            bot={ln.ganZhi}
            active={ln.year === currentYear}
            narrow
          />
        ))}
      </div>
    </div>
  )
}
