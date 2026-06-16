import { type ReactNode, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type AdminTab = 'overview' | 'messages' | 'users'

interface Props {
  tab: AdminTab
  onTabChange: (t: AdminTab) => void
  children: ReactNode
}

const TABS: { key: AdminTab; label: string; icon: ReactNode }[] = [
  {
    key: 'overview', label: '数据概览',
    icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    key: 'messages', label: '消息管理',
    icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  {
    key: 'users', label: '用户管理',
    icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  },
]


export default function AdminLayout({ tab, onTabChange, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-slate-100">
      {/* ── 移动端遮罩 ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── 侧边栏 ── */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-white/[0.07] bg-[#111] transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.07] px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">五</span>
          <span className="text-sm font-semibold text-amber-100">管理后台</span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-0.5 p-3">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onTabChange(key); setSidebarOpen(false) }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                tab === key
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {/* 退出 */}
        <div className="border-t border-white/[0.07] p-3">
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white/[0.05] hover:text-rose-400 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            退出登录
          </button>
        </div>
      </aside>

      {/* ── 主内容区 ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* 顶部栏（移动端） */}
        <header className="flex h-14 items-center border-b border-white/[0.07] px-4 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-1 text-slate-400">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span className="ml-3 text-sm font-medium text-amber-100">{TABS.find((t) => t.key === tab)?.label}</span>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
