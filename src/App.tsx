import { lazy, Suspense, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { signOut } from './lib/auth'
import { saveReading, saveHeBanReading } from './lib/history'
import { supabase } from './lib/supabase'
import { clearWizardSnapshot, loadWizardSnapshot, saveWizardSnapshot } from './lib/wizardSession'
import { PointsProvider, usePoints } from './lib/PointsContext'
import PointsModal from './components/PointsModal'
import Step1Input from './pages/Step1Input'
import HeBanInputPage from './pages/HeBanInputPage'
import AuthPage from './pages/AuthPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HistoryPage from './pages/HistoryPage'
import type { HeBanResults, HeBanUserInput, ReportResults, UserInput } from './lib/types'
import PrivateRoute from './components/PrivateRoute'

const Step3Report = lazy(() => import('./pages/Step3Report'))
const HeBanReport = lazy(() => import('./pages/HeBanReport'))

type Step = 1 | 2
type AppMode = 'single' | 'heban'

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

// ─── 顶部导航栏 ───────────────────────────────────────────────────────────────

function TopNav({
  user,
  onOpenAuth,
  onHistory,
  onHome,
  mode,
  onSwitchMode,
  showHistory,
}: {
  user: User | null
  onOpenAuth: () => void
  onHistory: () => void
  onHome: () => void
  mode: AppMode
  onSwitchMode: (m: AppMode) => void
  showHistory: boolean
}) {
  const { balance } = usePoints()
  const [showPointsModal, setShowPointsModal] = useState(false)

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[100] h-14 border-b border-white/[0.07] bg-black/75 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">

          {/* ── 左：Logo ── */}
          <button
            type="button"
            onClick={onHome}
            className="flex shrink-0 items-center gap-2 text-left"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-900">
              五
            </span>
            <span className="hidden text-sm font-semibold tracking-wide text-amber-100 sm:block">
              五行能量
            </span>
          </button>

          {/* ── 中：模式切换（仅非历史页显示） ── */}
          {!showHistory && (
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => onSwitchMode('single')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  mode === 'single'
                    ? 'bg-amber-400/20 border border-amber-400/40 text-amber-100'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                ✦ 单人
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('heban')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  mode === 'heban'
                    ? 'bg-amber-400/20 border border-amber-400/40 text-amber-100'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                ☯ 合盘
              </button>
            </div>
          )}

          {/* ── 右：功能按钮区 ── */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">

            {/* 积分 */}
            <button
              type="button"
              onClick={() => setShowPointsModal(true)}
              className="flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/20 transition-colors"
            >
              <span className="text-[13px]">💎</span>
              <span className="tabular-nums">{balance}</span>
              <span className="hidden sm:inline text-amber-200/70 ml-0.5">积分</span>
            </button>

            {/* 历史档案 */}
            <button
              type="button"
              onClick={showHistory ? onHome : onHistory}
              className={[
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                showHistory
                  ? 'border-white/20 bg-white/10 text-slate-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200',
              ].join(' ')}
            >
              <span className="hidden sm:inline">历史档案</span>
              <span className="sm:hidden">📂</span>
            </button>

            {/* 用户区 */}
            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden max-w-[6rem] truncate rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-300 sm:block">
                  {nicknameOf(user)}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut().catch(() => {})}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200 transition-colors"
                  title="退出登录"
                >
                  退出
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-lg border border-amber-400/45 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/25 transition-colors"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 积分中心弹窗 */}
      <PointsModal open={showPointsModal} onClose={() => setShowPointsModal(false)} />
    </>
  )
}

// ─── 主应用 ────────────────────────────────────────────────────────────────────

function WizardApp({ user }: { user: User | null }) {
  const w0 = loadWizardSnapshot()
  const [mode, setMode] = useState<AppMode>('single')
  const [step, setStep] = useState<Step>(w0.step === 2 ? 2 : 1)
  const [input, setInput] = useState<UserInput | null>(w0.input)
  const [results, setResults] = useState<ReportResults | null>(w0.results)
  const [isComputing, setIsComputing] = useState(false)
  const [step1Key, setStep1Key] = useState(0)

  // 合盘状态
  const [heBanStep, setHeBanStep] = useState<1 | 2>(1)
  const [heBanInput, setHeBanInput] = useState<HeBanUserInput | null>(null)
  const [heBanResults, setHeBanResults] = useState<HeBanResults | null>(null)
  const [isHeBanComputing, setIsHeBanComputing] = useState(false)

  const [showAuth, setShowAuth] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (step === 2 && input && results) {
      saveWizardSnapshot(2, input, results)
    }
  }, [step, input, results])

  const switchMode = (newMode: AppMode) => {
    setMode(newMode)
    setShowHistory(false)
    if (newMode === 'single') {
      setHeBanStep(1)
      setHeBanInput(null)
      setHeBanResults(null)
    } else {
      setStep1Key((k) => k + 1)
      setStep(1)
      clearWizardSnapshot()
    }
  }

  const goHome = () => {
    setShowHistory(false)
    setStep1Key((k) => k + 1)
    setStep(1)
    setHeBanStep(1)
    setHeBanResults(null)
    clearWizardSnapshot()
  }

  return (
    <div className="min-h-screen">
      <TopNav
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onHistory={() => setShowHistory(true)}
        onHome={goHome}
        mode={mode}
        onSwitchMode={switchMode}
        showHistory={showHistory}
      />
      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} /> : null}

      {/* 内容区域，padding-top 留出 nav 高度 */}
      <div className="pt-14">
        {showHistory ? (
          <HistoryPage onBack={() => setShowHistory(false)} />
        ) : (
          <>
            {/* ── 单人测算流程 ── */}
            {mode === 'single' && (
              <>
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
                        onReset={() => {
                          setStep1Key((k) => k + 1)
                          setStep(1)
                          clearWizardSnapshot()
                        }}
                      />
                    </>
                  </Suspense>
                )}
              </>
            )}

            {/* ── 合盘流程 ── */}
            {mode === 'heban' && (
              <>
                {heBanStep === 1 && (
                  <HeBanInputPage
                    isSubmitting={isHeBanComputing}
                    onNext={async (data) => {
                      if (isHeBanComputing) return
                      setIsHeBanComputing(true)
                      try {
                        const { computeAll } = await import('./lib/mingli/computeReport')
                        const resultA = computeAll(data.personA)
                        const resultB = computeAll(data.personB)
                        setHeBanInput(data)
                        setHeBanResults({ resultA, resultB })
                        setHeBanStep(2)
                      } finally {
                        setIsHeBanComputing(false)
                      }
                    }}
                  />
                )}

                {heBanStep === 2 && heBanInput && heBanResults && (
                  <Suspense fallback={<StepLoading />}>
                    <>
                      <div className="mx-auto max-w-xl px-4">
                        <div className="mt-2 flex items-center justify-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setHeBanStep(1)
                              setHeBanResults(null)
                            }}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/20"
                          >
                            返回修改
                          </button>
                        </div>
                      </div>
                      <HeBanReport
                        input={heBanInput}
                        results={heBanResults}
                        onAIReportComplete={async (aiReport) => {
                          try {
                            await saveHeBanReading(heBanInput, aiReport)
                          } catch {
                            /* 静默失败 */
                          }
                        }}
                        onReset={() => {
                          setHeBanStep(1)
                          setHeBanResults(null)
                        }}
                      />
                    </>
                  </Suspense>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 根组件 ───────────────────────────────────────────────────────────────────

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
    <PointsProvider>
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
    </PointsProvider>
  )
}

// ─── 登录弹窗 ─────────────────────────────────────────────────────────────────

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
