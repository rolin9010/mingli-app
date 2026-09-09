import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const ALLOWED_TYPES = new Set<EmailOtpType>(['magiclink', 'email'])

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/?miniprogram=1'
  return value
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

    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setMessage('连接链接已失效，请返回小程序重新打开')
        return
      }
      window.location.replace(next)
    })
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
