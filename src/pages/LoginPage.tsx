import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AuthError } from '@supabase/supabase-js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) throw authError
      navigate('/')
    } catch (err: unknown) {
      const ae = err as AuthError
      setError(ae?.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-wide text-amber-100">登录</div>
          <div className="mt-2 text-xs text-slate-400">使用邮箱密码登录</div>
        </div>

        <div className="w-full rounded-2xl border border-amber-400/25 bg-slate-950/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none ring-amber-400/30 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-1"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none ring-amber-400/30 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-1"
                placeholder="至少 6 位"
                autoComplete="current-password"
                minLength={6}
              />
            </div>

            {error ? <p className="text-center text-xs text-rose-400/95">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-amber-400/60 bg-amber-400/20 py-3 text-sm font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)] hover:bg-amber-400/30 disabled:opacity-50"
            >
              {loading ? '请稍候…' : '登录'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-400">
            没有账号？{' '}
            <Link className="font-medium text-amber-100 hover:underline" to="/register">
              去注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

