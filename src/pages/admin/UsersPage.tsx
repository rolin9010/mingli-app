import { useEffect, useState } from 'react'
import { adminGetUsers, type AdminUser } from '../../lib/admin'
import UserDetailPanel from './UserDetailPanel'

// ─── 用户列表 ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    adminGetUsers().then((u) => { setUsers(u); setLoading(false) })
  }, [])

  if (selectedUserId) {
    return <UserDetailPanel userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
  }

  const filtered = users.filter(
    (u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-100">用户管理</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索邮箱 / ID…"
          className="w-52 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-4 border-b border-white/[0.07] px-5 py-3 text-[11px] font-medium text-slate-500">
            <div>邮箱</div>
            <div className="text-center">积分余额</div>
            <div className="text-center">测算次数</div>
            <div className="text-right">操作</div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-600">暂无用户</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((u) => (
                <div key={u.id} className="grid grid-cols-4 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
                  <div className="text-xs text-slate-200 truncate">{u.email}</div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-amber-300">{u.balance}</span>
                  </div>
                  <div className="text-center text-xs text-slate-400">{u.readingCount}</div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-amber-400/30 hover:text-amber-200 transition-colors"
                    >
                      详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
