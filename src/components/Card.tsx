import type { ReactNode } from 'react'

export default function Card({
  icon,
  title,
  headerRight,
  children,
}: {
  icon?: ReactNode
  title?: string
  /** 标题行右侧（如提示文案），与卡片右内边距对齐 */
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-white/5 p-5 shadow-[0_0_0_0.5px_rgba(251,191,36,0.06),0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
      {(title || icon || headerRight) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/25 bg-amber-300/5 text-amber-200">
                {icon}
              </div>
            )}
            {title && (
              <h3 className="text-base font-semibold tracking-wide text-amber-100">{title}</h3>
            )}
          </div>
          {headerRight ? (
            <div className="shrink-0 pt-0.5 text-right text-xs text-amber-300/60">{headerRight}</div>
          ) : null}
        </div>
      )}
      <div className="text-sm leading-7 text-slate-100">{children}</div>
    </div>
  )
}

