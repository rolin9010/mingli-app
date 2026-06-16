import { useEffect, useState } from 'react'
import { adminGetUsers, adminAdjustPoints, type AdminUser } from '../../lib/admin'

export default function PointsPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // 内联调整积分状态：{ [userId]: { delta, desc, busy, msg } }
  const [adjustState, setAdjustState] = useState<Record<string, {
    delta: string; desc: string; busy: boolean; msg: { type: 'ok' | 'err'; text: string } | null
  }>>({})

  const load = () => {
    setLoading(true)
    adminGetUsers().then((u) => { setUsers(u); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const getState = (uid: string) =>
    adjustState[uid] ?? { delta: '', desc: '', busy: false, msg: null }

  const setState = (uid: string, patch: Partial<typeof adjustState[string]>) =>
    setAdjustState((prev) => ({ ...prev, [uid]: { ...getState(uid), ...patch } }))

  const handleAdjust = async (user: AdminUser) => {
    const s = getState(user.id)
    const delta = parseInt(s.delta)
    if (isNaN(delta) || delta === 0) {
      setState(user.id, { msg: { type: 'err', text: '请输入有效数字' } })
      setTimeout(() => setState(user.id, { msg: null }), 2500)
      return
    }
    if (!s.desc.trim()) {
      setState(user.id, { msg: { type: 'err', text: '请填写原因' } })
      setTimeout(() => setState(user.id, { msg: null }), 2500)
      return
    }
    setState(user.id, { busy: true })
    const { success, error } = await adminAdjustPoints(user.id, delta, s.desc.trim())
    if (success) {
      setState(user.id, { busy: false, delta: '', desc: '', msg: { type: 'ok', text: `已${delta > 0 ? '+' : ''}${delta} 积分` } })
      // 刷新这个用户的积分
      load()
    } else {
      setState(user.id, { busy: false, msg: { type: 'err', text: error ?? '操作失败' } })
    }
    setTimeout(() => setState(user.id, { msg: null }), 3000)
  }

  const filtered = users.filter(
    (u) => u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-100">积分管理</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索邮箱…"
          className="w-52 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-600">暂无用户</div>
          ) : filtered.map((u) => {
            const s = getState(u.id)
            return (
              <div key={u.id} className="rounded-2xl border border-white/[0.07] bg-[#111] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* 用户信息 */}
                  <div className="min-w-0">
                    <div className="text-xs text-slate-200 truncate">{u.email}</div>
                    <div className="mt-0.5 text-[11px] text-slate-600">测算 {u.readingCount} 次</div>
                  </div>
                  {/* 积分余额 */}
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500 mb-0.5">当前积分</div>
                    <div className="text-xl font-bold text-amber-300 tabular-nums">{u.balance}</div>
                  </div>
                </div>

                {/* 调整积分行 */}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <input
                    type="number"
                    value={s.delta}
                    onChange={(e) => setState(u.id, { delta: e.target.value })}
                    placeholder="+10 或 -5"
                    className="w-24 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={s.desc}
                    onChange={(e) => setState(u.id, { desc: e.target.value })}
                    placeholder="备注原因"
                    className="flex-1 min-w-32 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-400/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={s.busy}
                    onClick={() => void handleAdjust(u)}
                    className="rounded-xl bg-amber-500/60 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-400/80 disabled:opacity-40 transition-colors shrink-0"
                  >
                    {s.busy ? '执行中…' : '调整'}
                  </button>
                  {s.msg && (
                    <span className={`text-xs ${s.msg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.msg.text}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
