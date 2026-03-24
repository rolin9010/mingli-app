import type { ReactNode } from 'react'

export default function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        {hint && <span className="text-xs text-amber-100/80">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

