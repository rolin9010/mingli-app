import { type ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')
  const location = useLocation()

  // 小程序 WebView 模式：跳过登录，直接放行
  const isMiniprogram = new URLSearchParams(location.search).get('miniprogram') === '1'

  useEffect(() => {
    // 小程序模式不需要检查登录态
    if (isMiniprogram) return

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
  }, [isMiniprogram])

  // 小程序模式直接放行，无需登录
  if (isMiniprogram) return <>{children}</>

  if (session === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">加载中…</div>
  }

  // 未登录时跳转到登录页（保留 query 参数以防万一）
  if (!session) {
    const loginUrl = location.search ? `/login${location.search}` : '/login'
    return <Navigate to={loginUrl} replace />
  }
  return <>{children}</>
}
