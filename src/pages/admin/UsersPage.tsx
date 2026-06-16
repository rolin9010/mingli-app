import { useEffect, useState } from 'react'
import { adminGetUsers, adminGetReadingsByDate, type AdminUser, type DayReadingItem } from '../../lib/admin'
import UserDetailPanel from './UserDetailPanel'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── 按日期查当日测算明细 ──────────────────────────────────────────────────────

interface DayViewProps {
  date: string
  onClear: () => void
  onUserClick: (userId: string) => void
}

function DayView({ date, onClear, onUserClick }: DayViewProps) {
  const [records, setRecords] = useState<DayReadingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminGetReadingsByDate(date).then((r) => { setRecords(r); setLoading(false) })
  }, [date])

  // 按用户聚合
  const userMap = new Map<string, { email: string; items: DayReadingItem[] }>()
  for (const r of records) {
    if (!userMap.has(r.user_id)) {
      userMap.set(r.user_id, { email: r.user_email, items: [] })
    }
    userMap.get(r.user_id)!.items.push(r)
  }
  const userGroups = Array.from(userMap.entries())

  return (
    <div className="space-y-4">
      {/* 面包屑 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-300 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          用户管理
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-amber-200">{date} 测算明细</span>
        <span className="ml-auto text-xs text-slate-600">共 {records.length} 条记录 · {userGroups.length} 位用户</span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : userGroups.length === 0 ? (
        <div className="py-20 text-center text-sm text-slate-600">该日暂无测算记录</div>
      ) : (
        <div className="space-y-4">
          {userGroups.map(([uid, { email, items }]) => (
            <div key={uid} className="rounded-2xl border border-white/[0.07] bg-[#111] overflow-hidden">
              {/* 用户标题行 */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05] bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/15 text-amber-200 text-xs font-bold">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-200 truncate max-w-[240px]">{email}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{items.length} 次测算</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUserClick(uid)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-amber-400/30 hover:text-amber-200 transition-colors"
                >
                  用户详情
                </button>
              </div>

              {/* 该用户当日测算列表 */}
              <div className="divide-y divide-white/[0.04]">
                {/* 表头 */}
                <div className="grid grid-cols-5 px-5 py-2.5 text-[10px] font-medium text-slate-600">
                  <div>姓名</div>
                  <div>出生日期</div>
                  <div className="col-span-2">测算类型</div>
                  <div className="text-right">时间</div>
                </div>

                {items.map((item) => {
                  // 解析测算类型
                  let readingType = '个人测算'
                  try {
                    const d = item.input_data as Record<string, unknown>
                    if (d?.personA) {
                      const rel = (d.relationship as string | undefined) ?? '未知关系'
                      readingType = `合盘 · ${rel}`
                    }
                  } catch { /* noop */ }

                  return (
                    <div key={item.id} className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="text-xs text-slate-200">{item.name ?? '-'}</div>
                      <div className="text-xs text-slate-400">{item.birth_date ?? '-'}</div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          readingType.startsWith('合盘')
                            ? 'bg-purple-400/15 text-purple-300'
                            : 'bg-amber-400/15 text-amber-300'
                        }`}>
                          {readingType}
                        </span>
                        {item.ai_report && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-400">
                            有AI报告
                          </span>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-500">{formatTime(item.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 用户列表 ─────────────────────────────────────────────────────────────────

interface Props {
  filterDate?: string | null
  onClearFilter?: () => void
}

export default function UsersPage({ filterDate, onClearFilter }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    adminGetUsers().then((u) => { setUsers(u); setLoading(false) })
  }, [])

  // 若在日期明细视图中点击"用户详情"，先清空日期筛选再进入详情
  if (selectedUserId) {
    return (
      <UserDetailPanel
        userId={selectedUserId}
        onBack={() => {
          setSelectedUserId(null)
        }}
      />
    )
  }

  // 按日期筛选视图
  if (filterDate) {
    return (
      <DayView
        date={filterDate}
        onClear={() => onClearFilter?.()}
        onUserClick={(uid) => {
          onClearFilter?.()
          setSelectedUserId(uid)
        }}
      />
    )
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
