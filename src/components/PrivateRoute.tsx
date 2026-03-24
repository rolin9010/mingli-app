import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
    })().catch(() => {
      if (!mounted) return
      setSession(null)
    })

    const sub = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
    })
    subscription = sub.data.subscription

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  if (session === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">加载中…</div>
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

