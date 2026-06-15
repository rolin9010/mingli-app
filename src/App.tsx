import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { signOut } from './lib/auth'
import { saveReading, saveHeBanReading } from './lib/history'
import { supabase } from './lib/supabase'
import { clearWizardSnapshot, loadWizardSnapshot, saveWizardSnapshot } from './lib/wizardSession'
import { PointsProvider, usePoints } from './lib/PointsContext'
import PointsModal from './components/PointsModal'
import Step1Input from './pages/Step1Input'
import ConsultModal from './components/ConsultModal'
import HeBanInputPage from './pages/HeBanInputPage'
import AuthPage from './pages/AuthPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HistoryPage from './pages/HistoryPage'
import type { HeBanResults, HeBanUserInput, ReportResults, UserInput } from './lib/types'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'
import AdminPage from './pages/admin/AdminPage'

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
  showHistory,
  onOpenConsult,
}: {
  user: User | null
  onOpenAuth: () => void
  onHistory: () => void
  onHome: () => void
  showHistory: boolean
  onOpenConsult: () => void
}) {
  const { balance } = usePoints()
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  // 未读客服回复数量
  const [unreadCount, setUnreadCount] = useState(0)
  // 已见过的 reply id 集合（用于增量判断），初始从 localStorage 恢复
  const seenReplyIds = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem('seen_reply_ids')
      return new Set<string>(saved ? (JSON.parse(saved) as string[]) : [])
    } catch { return new Set<string>() }
  })())

  // 持久化已见 id 到 localStorage
  const persistSeen = () => {
    try {
      localStorage.setItem('seen_reply_ids', JSON.stringify([...seenReplyIds.current]))
    } catch {}
  }

  // 轮询：统计有回复但用户还没看过的消息数
  const checkUnread = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('support_messages')
      .select('id')
      .eq('user_id', user.id)
      .not('reply', 'is', null)
    if (!data) return
    const count = data.filter((row) => !seenReplyIds.current.has(row.id as string)).length
    setUnreadCount(count)
  }, [user])

  useEffect(() => {
    if (!user) return
    void checkUnread()
    const t = setInterval(() => void checkUnread(), 20_000)
    return () => clearInterval(t)
  }, [user, checkUnread])

  const handleOpenConsult = () => {
    // 打开弹窗时：把所有当前有回复的消息 id 标记为已见，清零计数
    supabase
      .from('support_messages')
      .select('id')
      .eq('user_id', user?.id ?? '')
      .not('reply', 'is', null)
      .then(({ data }) => {
        for (const row of (data ?? [])) seenReplyIds.current.add(row.id as string)
        persistSeen()
        setUnreadCount(0)
      })
    onOpenConsult()
  }

  // 点击任何地方关闭下拉
  const closeMenu = () => setShowUserMenu(false)

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-[100] h-14 border-b border-white/[0.07] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-4xl items-center justify-between gap-4 px-8 sm:px-12">

          {/* ── 左：Logo ── */}
          <button
            type="button"
            onClick={onHome}
            className="flex shrink-0 items-center gap-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.4)]">
              五
            </span>
            <span className="hidden text-sm font-semibold tracking-wide text-amber-100 sm:block">
              五行能量
            </span>
          </button>

          {/* ── 右：功能链接 + 用户区 ── */}
          <div className="relative flex shrink-0 items-center gap-1">
            {/* 积分中心 */}
            <button
              type="button"
              onClick={() => setShowPointsModal(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:text-amber-200 transition-colors"
            >
              <svg className="h-4 w-4 text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2"/></svg>
              <span className="text-xs">积分中心</span>
              <span className="ml-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-300">{balance}</span>
            </button>

            {/* 历史记录 */}
            <button
              type="button"
              onClick={showHistory ? onHome : onHistory}
              className={[
                'hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
                showHistory ? 'text-amber-200' : 'text-slate-300 hover:text-slate-100',
              ].join(' ')}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
              历史记录
            </button>
            {/* 移动端积分角标 */}
            <button
              type="button"
              onClick={() => setShowPointsModal(true)}
              className="flex sm:hidden items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-xs font-medium text-amber-100"
            >
              💎 {balance}
            </button>

            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-white/25 hover:bg-white/10 transition-all"
                >
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  <span className="max-w-[6rem] truncate">{nicknameOf(user)}</span>
                  <svg
                    className={`h-3 w-3 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  ><path d="M6 9l6 6 6-6"/></svg>
                </button>

                {/* 下拉菜单 */}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={closeMenu} />
                    <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl">
                      <div className="py-1.5">
                        <DropdownItem
                          icon={<svg className="h-4 w-4 text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2"/></svg>}
                          label="积分中心"
                          badge={String(balance)}
                          onClick={() => { closeMenu(); setShowPointsModal(true) }}
                        />
                        <DropdownItem
                          icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.49"/></svg>}
                          label="重新测算"
                          onClick={() => { closeMenu(); onHome() }}
                        />
                        <DropdownItem
                          icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>}
                          label="历史记录"
                          onClick={() => { closeMenu(); onHistory() }}
                        />
                        <DropdownItem
                          icon={
                            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          }
                          label="客服消息"
                          badge={unreadCount > 0 ? String(unreadCount) : undefined}
                          badgeDanger={unreadCount > 0}
                          onClick={() => { closeMenu(); handleOpenConsult() }}
                        />
                        <div className="my-1 border-t border-white/8" />
                        <DropdownItem
                          icon={<svg className="h-4 w-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                          label="退出登录"
                          danger
                          onClick={() => { closeMenu(); void signOut().catch(() => {}) }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="rounded-full border border-amber-400/50 bg-amber-400/15 px-4 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/25 transition-colors"
              >
                登录 / 注册
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

function DropdownItem({
  icon,
  label,
  badge,
  badgeDanger,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  badge?: string
  badgeDanger?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/[0.05] ${
        danger ? 'text-rose-400' : 'text-slate-200'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
          badgeDanger
            ? 'bg-rose-500/20 text-rose-400'
            : 'bg-amber-400/20 text-amber-300'
        }`}>
          {badge}
        </span>
      )}
    </button>
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
  const [showConsult, setShowConsult] = useState(false)

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
        showHistory={showHistory}
        onOpenConsult={() => setShowConsult(true)}
      />
      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} /> : null}
      {/* 全局客服弹窗（从导航栏消息图标触发） */}
      {showConsult && (
        <ConsultModal
          open={showConsult}
          onClose={() => setShowConsult(false)}
        />
      )}

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
                    mode={mode}
                    onSwitchMode={switchMode}
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
                  </Suspense>
                )}
              </>
            )}

            {/* ── 合盘流程 ── */}
            {mode === 'heban' && (
              <>
                {heBanStep === 1 && (
                  <HeBanInputPage
                    mode={mode}
                    onSwitchMode={switchMode}
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
                    />
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
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
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
