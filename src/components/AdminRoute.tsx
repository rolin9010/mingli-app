import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdminEmail } from '../lib/admin'

type State = 'loading' | 'allowed' | 'forbidden' | 'unauthenticated'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const email = data.session?.user?.email
      if (!data.session) {
        setState('unauthenticated')
      } else if (isAdminEmail(email)) {
        setState('allowed')
      } else {
        setState('forbidden')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      const email = session?.user?.email
      if (!session) setState('unauthenticated')
      else if (isAdminEmail(email)) setState('allowed')
      else setState('forbidden')
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-slate-400">
        验证权限中…
      </div>
    )
  }
  if (state === 'unauthenticated') return <Navigate to="/login" replace />
  if (state === 'forbidden') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
        <div className="text-2xl">🚫</div>
        <div className="text-sm text-slate-300">无管理员权限</div>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
        >
          切换账号
        </button>
      </div>
    )
  }
  return <>{children}</>
}
