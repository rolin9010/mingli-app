import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isReadOnlyMiniProgramHistoryPath } from '../lib/miniProgramEntry'

const ALLOWED_TYPES = new Set<EmailOtpType>(['magiclink', 'email'])

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/?miniprogram=1'
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return '/?miniprogram=1'
    return `${url.pathname}${url.search}`
  } catch {
    return '/?miniprogram=1'
  }
}

export default function MiniSessionPage() {
  const [message, setMessage] = useState('正在连接你的专属账号…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const rawType = params.get('type') as EmailOtpType | null
    const type = rawType && ALLOWED_TYPES.has(rawType) ? rawType : 'magiclink'
    const next = safeNextPath(params.get('next'))

    if (!tokenHash) {
      setMessage('连接链接无效，请返回小程序重试')
      return
    }

    void (async () => {
      try {
        // 通过同域 API 兑换，避免微信 WebView 直接请求 Supabase Auth 的兼容性问题。
        const response = await fetch('/api/miniprogram-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type }),
        })
        const payload = await response.json().catch(() => ({})) as {
          access_token?: string
          refresh_token?: string
          errorCode?: string
        }

        if (response.ok && payload.access_token && payload.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
          })
          if (!error) {
            window.location.replace(next)
            return
          }
          console.warn('miniprogram-session setSession failed:', error.code || error.name)
        } else {
          console.warn('miniprogram-session exchange failed:', payload.errorCode || response.status)
        }
      } catch (error) {
        console.warn(
          'miniprogram-session request failed:',
          error instanceof Error ? error.name : 'unknown',
        )
      }

      // 历史档案允许只读访问；登录兑换异常时仍让用户看到已有档案。
      if (isReadOnlyMiniProgramHistoryPath(next)) {
        window.location.replace(next)
        return
      }
      setMessage('连接链接已失效，请返回小程序重新打开')
    })()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center">
      <div>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-lg font-bold text-amber-200">
          五
        </div>
        <h1 className="text-lg font-semibold text-amber-100">松眠疗愈</h1>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      </div>
    </main>
  )
}
