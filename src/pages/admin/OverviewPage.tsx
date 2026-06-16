import { useEffect, useState } from 'react'
import { adminGetStats, type AdminStats } from '../../lib/admin'

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

export default function OverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetStats().then((s) => { setStats(s); setLoading(false) })
  }, [])

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
  }
  if (!stats) return null

  const maxCount = Math.max(...stats.dailyRegistrations.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-100">数据概览</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="总用户数" value={stats.totalUsers} icon="👥" color="text-slate-100" />
        <StatCard label="今日活跃测算" value={stats.todayRegistered} icon="🔮" color="text-amber-300" />
        <StatCard label="今日积分消耗" value={stats.todayPointsConsumed} icon="💎" color="text-amber-400" />
        <StatCard label="待回复消息" value={stats.pendingMessages} icon="💬" color={stats.pendingMessages > 0 ? 'text-rose-400' : 'text-slate-100'} />
      </div>

      {/* 近 7 天图表 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
        <h2 className="mb-6 text-sm font-medium text-slate-300">近 7 天测算活跃（按日）</h2>
        {/* 固定高度容器，用绝对定位让柱子从底部生长 */}
        <div className="flex items-end gap-3" style={{ height: 120 }}>
          {stats.dailyRegistrations.map((d) => {
            const BAR_MAX = 100  // 柱子最大高度 px
            const barH = maxCount > 0 ? Math.max(Math.round((d.count / maxCount) * BAR_MAX), d.count > 0 ? 6 : 2) : 2
            const label = d.date.slice(5) // MM-DD
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] text-slate-500">{d.count > 0 ? d.count : ''}</span>
                <div
                  className={`rounded-t-sm transition-all ${d.count > 0 ? 'bg-amber-400/70' : 'bg-white/[0.05]'}`}
                  style={{ height: barH, width: '40%' }}
                />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
