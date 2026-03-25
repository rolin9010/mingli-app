import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AuthError } from '@supabase/supabase-js'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [mailSent, setMailSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const toFriendlyError = (message: string): string => {
    const m = message.toLowerCase()
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) return '该邮箱已注册'
    if (m.includes('password') && (m.includes('short') || m.includes('least'))) return '密码太短'
    return message || '注册失败，请重试'
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || mailSent) return
    setError('')
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (authError) throw authError
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError('该邮箱已注册，请直接登录')
        return
      }
      setMailSent(true)
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); setMailSent(false); return 0 }
          return c - 1
        })
      }, 1000)
    } catch (err: unknown) {
      const ae = err as AuthError
      setError(toFriendlyError(ae?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-wide text-amber-100">注册</div>
          <div className="mt-2 text-xs text-slate-400">注册后需要邮箱验证</div>
        </div>
        <div className="w-full rounded-2xl border border-amber-400/25 bg-slate-950/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
          <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
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
                disabled={mailSent}
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
                autoComplete="new-password"
                minLength={6}
                disabled={mailSent}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">确认密码</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none ring-amber-400/30 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-1"
                placeholder="再次输入密码"
                autoComplete="new-password"
                minLength={6}
                disabled={mailSent}
              />
            </div>
            {error ? <p className="text-center text-xs text-rose-400/95">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || mailSent}
              className={[
                'w-full rounded-xl border py-3 text-sm font-semibold shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]',
                mailSent
                  ? 'cursor-not-allowed border-white/20 bg-white/10 text-slate-300'
                  : 'border-amber-400/60 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 disabled:opacity-60',
              ].join(' ')}
            >
              {mailSent ? `邮件已发送 ✓（${countdown}s 后可重发）` : loading ? '发送中...' : '注册'}
            </button>
            {mailSent ? (
              <p className="text-center text-xs text-amber-100/80">
                验证邮件已发送至 {email.trim()}，请查收邮件并点击确认链接，验证成功后请返回此处用邮箱密码登录。
              </p>
            ) : null}
          </form>
          <div className="mt-4 text-center text-xs text-slate-400">
            已有账号？{' '}
            <Link className="font-medium text-amber-100 hover:underline" to="/login">
              去登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
