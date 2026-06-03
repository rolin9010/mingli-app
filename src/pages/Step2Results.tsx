import { useMemo } from 'react'
import BaziPanCard from '../components/BaziPanCard'
import { BaziDayunHorizontal, BaziLiuNianHorizontal } from '../components/BaziDayunLiuNianBoard'
import { computeBaziContext } from '../lib/mingli/bazi'
import { buildBaziPanModel } from '../lib/mingli/baziPan'
import { computeOriginBranchRelations, computeOriginStemRelations } from '../lib/mingli/baziRelations'
import type { BaziResult, ReportResults, UserInput } from '../lib/types'

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

/** 各体系详细排盘，供结果页嵌入 */
export function Step2ChartsSection({
  input,
  results,
}: {
  input: UserInput
  results: ReportResults
}) {
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

  const stemRelations = useMemo(
    () => computeOriginStemRelations(baziPan.columns.map((c) => c.stem)),
    [baziPan],
  )
  const branchRelations = useMemo(
    () => computeOriginBranchRelations(baziPan.columns.map((c) => c.branch)),
    [baziPan],
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="mx-auto w-full max-w-3xl">
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
            <WuxingEnergyCards elements={results.bazi.elements} />
            {results.bazi.dayun?.rows?.length ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs leading-6 text-slate-100/85">
                <div className="mb-1.5 font-medium text-amber-200/90">大运（十年一步）</div>
                <div className="mb-2 text-[11px] text-slate-300/90">{results.bazi.dayun.qiYunText}</div>
                <div className="mb-2.5 text-[11px] text-slate-400">
                  顺逆：{results.bazi.dayun.isForward ? '顺排' : '逆排'}；金色描边为当前公历年所在大运。
                </div>
                <BaziDayunHorizontal dayun={results.bazi.dayun} />
                <div className="mb-1.5 mt-5 font-medium text-amber-200/90">流年（立春换年）</div>
                <div className="mb-2.5 text-[11px] text-slate-400">
                  以当前年为中心前后各 5 年；金色描边为今年。
                </div>
                <BaziLiuNianHorizontal birthYear={input.birth.year} />
              </div>
            ) : null}
            <div className="rounded-xl border border-amber-400/20 bg-white/5 p-3 text-xs leading-6 text-slate-100/80">
              注：四柱/节气换年使用 lunar-javascript 计算；五行分布为基于干支主气映射的统计展示。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
