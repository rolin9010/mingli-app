import type { ReactNode } from 'react'
import type { BaziPanModel } from '../lib/mingli/baziPan'

/** 深色底上的五行色（与结果页其他卡片一致的可读对比度） */
const STEM_CLASS: Record<string, string> = {
  甲: 'text-emerald-400',
  乙: 'text-emerald-400',
  丙: 'text-red-400',
  丁: 'text-red-400',
  戊: 'text-amber-300',
  己: 'text-amber-300',
  庚: 'text-slate-200',
  辛: 'text-slate-200',
  壬: 'text-sky-400',
  癸: 'text-sky-400',
}

const BRANCH_CLASS: Record<string, string> = {
  寅: 'text-emerald-400',
  卯: 'text-emerald-400',
  巳: 'text-red-400',
  午: 'text-red-400',
  申: 'text-amber-200',
  酉: 'text-amber-200',
  亥: 'text-sky-400',
  子: 'text-sky-400',
  辰: 'text-amber-300',
  戌: 'text-amber-300',
  丑: 'text-amber-300',
  未: 'text-amber-300',
}

function stemClass(ch: string) {
  return STEM_CLASS[ch] ?? 'text-slate-200'
}
function branchClass(ch: string) {
  return BRANCH_CLASS[ch] ?? 'text-slate-200'
}

function Cell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <td
      className={`border border-white/10 px-1.5 py-2 text-center align-middle text-[13px] leading-snug text-slate-200/95 ${className}`}
    >
      {children}
    </td>
  )
}

export default function BaziPanCard({
  model,
  /** 嵌入外层大卡片时：去掉独立外框，仅保留上圆角与底部分隔线 */
  embedded,
}: {
  model: BaziPanModel
  embedded?: boolean
}) {
  const cols = model.columns

  const shell = embedded
    ? 'overflow-hidden rounded-t-2xl border-0 bg-transparent shadow-none backdrop-blur-none'
    : 'overflow-hidden rounded-2xl border border-amber-400/25 bg-white/5 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06),0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur'

  return (
    <div className={shell}>
      <div className="bg-white/[0.03] px-3 py-3 text-center sm:px-4 sm:py-3.5">
        <h2 className="text-base font-semibold tracking-wide text-amber-100 sm:text-lg">{model.title}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs leading-snug text-slate-200/90 sm:text-sm sm:gap-x-2.5">
          <span className="whitespace-nowrap">
            {model.gender === '女' ? '♀' : '♂'} {model.gender}
          </span>
          <span className="text-amber-400/60">·</span>
          <span className="whitespace-nowrap">
            公历 {model.solarLine}
            {model.usedTrueSolar ? <span className="ml-1 text-[11px] text-emerald-400/95 sm:text-xs">（真太阳时）</span> : null}
          </span>
          <span className="text-amber-400/60">·</span>
          <span className="whitespace-nowrap text-violet-300/90">农历 {model.lunarLine}</span>
        </div>
      </div>

      <div className="overflow-x-auto px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
        <table className="w-full min-w-[320px] border-collapse border border-white/10 text-slate-200/95">
          <tbody>
            <tr>
              <Cell className="w-[52px] bg-white/[0.06] text-xs font-medium text-slate-400">四柱</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel} className="bg-white/[0.06] text-xs font-semibold text-amber-200/95">
                  {c.pillarLabel}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">主星</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-ss'} className="text-[12px] font-medium text-slate-200/95">
                  {c.mainGod}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">天干</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-tg'}>
                  <span className={`text-2xl font-bold tracking-widest ${stemClass(c.stem)}`}>{c.stem}</span>
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">地支</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-dz'}>
                  <span className={`text-2xl font-bold tracking-widest ${branchClass(c.branch)}`}>
                    {c.branch}
                  </span>
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] align-top text-xs font-medium text-slate-400">藏干</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-cg'} className="align-top text-[11px]">
                  <div className="flex flex-col gap-1">
                    {c.hidden.length === 0 ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      c.hidden.map((h, i) => (
                        <div key={i}>
                          <span className={`font-semibold ${stemClass(h.stem)}`}>{h.stem}</span>
                          <span className="text-slate-400/90">（{h.god}）</span>
                        </div>
                      ))
                    )}
                  </div>
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">星运</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-xy'} className="text-[12px] font-medium text-violet-300/95">
                  {c.xingYun}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">自坐</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-zz'} className="text-[12px] font-medium text-violet-300/95">
                  {c.ziZuo}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">空亡</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-xk'} className="text-[12px] text-slate-300/90">
                  {c.xunKong}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] text-xs font-medium text-slate-400">纳音</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-ny'} className="text-[12px] text-amber-200/90">
                  {c.naYin}
                </Cell>
              ))}
            </tr>
            <tr>
              <Cell className="bg-white/[0.06] align-top text-xs font-medium text-slate-400">神煞</Cell>
              {cols.map((c) => (
                <Cell key={c.pillarLabel + '-ss2'} className="align-top text-[11px] text-amber-200/85">
                  {c.shenSha.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <ul className="list-none space-y-0.5">
                      {c.shenSha.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </Cell>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
