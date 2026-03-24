import { useState, type FormEvent } from 'react'
import { signIn, signUp } from '../lib/auth'

export interface AuthPageProps {
  onSuccess: () => void
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        if (!nickname.trim()) {
          setError('请填写昵称')
          setLoading(false)
          return
        }
        await signUp(email.trim(), password, nickname.trim())
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-slate-950/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
      <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login')
            setError('')
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            mode === 'login' ? 'bg-amber-400/20 text-amber-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register')
            setError('')
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            mode === 'register' ? 'bg-amber-400/20 text-amber-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          注册
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {mode === 'register' ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none ring-amber-400/30 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-1"
              placeholder="用于显示"
              autoComplete="nickname"
            />
          </div>
        ) : null}
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
          />
        </div>

        {error ? <p className="text-center text-xs text-rose-400/95">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl border border-amber-400/60 bg-amber-400/20 py-3 text-sm font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)] hover:bg-amber-400/30 disabled:opacity-50"
        >
          {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>
    </div>
  )
}
