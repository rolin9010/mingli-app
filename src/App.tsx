import { lazy, Suspense, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { signOut } from './lib/auth'
import { saveReading } from './lib/history'
import { supabase } from './lib/supabase'
import { clearWizardSnapshot, loadWizardSnapshot, saveWizardSnapshot } from './lib/wizardSession'
import Step1Input from './pages/Step1Input'
import AuthPage from './pages/AuthPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HistoryPage from './pages/HistoryPage'
import type { ReportResults, UserInput } from './lib/types'
import PrivateRoute from './components/PrivateRoute'

const Step3Report = lazy(() => import('./pages/Step3Report'))

type Step = 1 | 2

function StepLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-300/90">
      加载测算模块…
    </div>
  )
}

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
      加载中…
    </div>
  )
}

function nicknameOf(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata as { nickname?: string } | undefined
  if (meta?.nickname && String(meta.nickname).trim()) return String(meta.nickname).trim()
  return user.email?.split('@')[0] ?? '用户'
}

function WizardApp({ user }: { user: User | null }) {
  const w0 = loadWizardSnapshot()
  const [step, setStep] = useState<Step>(w0.step === 2 ? 2 : 1)
  const [input, setInput] = useState<UserInput | null>(w0.input)
  const [results, setResults] = useState<ReportResults | null>(w0.results)
  const [isComputing, setIsComputing] = useState(false)
  const [step1Key, setStep1Key] = useState(0)

  const [showAuth, setShowAuth] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    /** 第 2 步：刷新后仍停留在报告页并命中缓存 */
    if (step === 2 && input && results) {
      saveWizardSnapshot(2, input, results)
    }
  }, [step, input, results])

  if (showHistory) {
    return (
      <div className="min-h-screen">
        <UserBar
          user={user}
          onOpenAuth={() => setShowAuth(true)}
          onHistory={() => setShowHistory(true)}
          onHome={() => setShowHistory(false)}
          showHistoryButton={false}
        />
        {showAuth ? <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} /> : null}
        <HistoryPage onBack={() => setShowHistory(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <UserBar
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onHistory={() => setShowHistory(true)}
        onHome={() => setShowHistory(false)}
        showHistoryButton
      />
      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} /> : null}

      {step === 1 && (
        <Step1Input
          key={step1Key}
          initialValues={step1Key > 0 ? input : null}
          isSubmitting={isComputing}
          onNext={async (data) => {
            if (isComputing) return
            setIsComputing(true)
            try {
              const { computeAll } = await import('./lib/mingli/computeReport')
              const res = computeAll(data)
              setInput(data)
              setResults(res)
              setStep(2)
              saveWizardSnapshot(2, data, res)
            } finally {
              setIsComputing(false)
            }
          }}
        />
      )}

      {step === 2 && input && results && (
        <Suspense fallback={<StepLoading />}>
          <>
            <div className="mx-auto max-w-6xl px-4">
              <div className="mt-2 flex items-center justify-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep1Key((k) => k + 1)
                    setStep(1)
                    clearWizardSnapshot()
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/20"
                >
                  返回修改
                </button>
              </div>
            </div>
            <Step3Report
              input={input}
              results={results}
              onAIReportComplete={async (aiReport) => {
                try {
                  await saveReading(input, aiReport)
                } catch {
                  /* 静默失败 */
                }
              }}
            />
          </>
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setUser(data.session?.user ?? null)
        setAuthChecked(true)
      })
      .catch(() => {
        if (!mounted) return
        setUser(null)
        setAuthChecked(true)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthChecked(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PrivateRoute>
            {authChecked ? <WizardApp user={user} /> : <AuthLoading />}
          </PrivateRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function UserBar({
  user,
  onOpenAuth,
  onHistory,
  onHome,
  showHistoryButton,
}: {
  user: User | null
  onOpenAuth: () => void
  onHistory: () => void
  onHome: () => void
  showHistoryButton: boolean
}) {
  return (
    <div className="fixed right-4 top-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-2">
      {user ? (
        <>
          <span className="hidden max-w-[10rem] truncate rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-amber-100/90 sm:inline-block">
            {nicknameOf(user)}
          </span>
          {showHistoryButton ? (
            <button
              type="button"
              onClick={onHistory}
              className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/20"
            >
              历史记录
            </button>
          ) : (
            <button
              type="button"
              onClick={onHome}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-white/25"
            >
              测算首页
            </button>
          )}
          <button
            type="button"
            onClick={() => void signOut().catch(() => {})}
            className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:border-white/25"
          >
            退出
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg border border-amber-400/45 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/25"
          >
            登录 / 注册
          </button>
          {showHistoryButton ? (
            <button
              type="button"
              onClick={onHistory}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200"
              title="登录后可同步历史"
            >
              历史记录
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md">
        <AuthPage onSuccess={onSuccess} />
      </div>
    </div>
  )
}
