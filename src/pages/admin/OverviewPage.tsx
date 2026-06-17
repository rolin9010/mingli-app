import { useEffect, useState } from 'react'
import { adminGetStats, type AdminStats } from '../../lib/admin'
import type { AdminTab } from './AdminLayout'

interface Props {
  onTabChange: (t: AdminTab) => void
  onBarClick: (date: string) => void
}

function StatCard({
  label, value, icon, color, onClick,
}: {
  label: string
  value: number | string
  icon: string
  color: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-white/[0.07] bg-[#111] p-5 ${onClick ? 'cursor-pointer hover:border-amber-400/30 hover:bg-white/[0.03] transition-colors' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      {onClick && <div className="mt-2 text-[10px] text-slate-600">点击查看详情 →</div>}
    </div>
  )
}

export default function OverviewPage({ onTabChange, onBarClick }: Props) {
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
        <StatCard
          label="总用户数" value={stats.totalUsers} icon="👥" color="text-slate-100"
          onClick={() => onTabChange('users')}
        />
        {/* 今日活跃测算 + 积分消耗合并卡片 */}
        <div
          onClick={() => onBarClick(new Date().toISOString().slice(0, 10))}
          className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 cursor-pointer hover:border-amber-400/30 hover:bg-white/[0.03] transition-colors col-span-2 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500">今日概况</span>
            <span className="text-lg">🔮</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-bold tabular-nums text-amber-300">{stats.todayRegistered}</div>
              <div className="mt-1 text-[11px] text-slate-500">测算次数</div>
            </div>
            <div className="w-px self-stretch bg-white/[0.06]" />
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-amber-400">{stats.todayPointsConsumed}</div>
              <div className="mt-1 text-[11px] text-slate-500">积分消耗</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-600">点击查看今日明细 →</div>
        </div>
        <StatCard
          label="待回复消息" value={stats.pendingMessages} icon="💬"
          color={stats.pendingMessages > 0 ? 'text-rose-400' : 'text-slate-100'}
          onClick={() => onTabChange('messages')}
        />
      </div>

      {/* 近 7 天图表 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
        <h2 className="mb-10 text-sm font-medium text-slate-300">近 7 天测算活跃（按日）</h2>
        <div className="flex items-end gap-3" style={{ height: 120 }}>
          {stats.dailyRegistrations.map((d) => {
            const BAR_MAX = 100
            const barH = maxCount > 0 ? Math.max(Math.round((d.count / maxCount) * BAR_MAX), d.count > 0 ? 6 : 2) : 2
            const label = d.date.slice(5) // MM-DD
            const clickable = d.count > 0
            return (
              <div
                key={d.date}
                className={`flex flex-1 flex-col items-center gap-1.5 ${clickable ? 'cursor-pointer group' : ''}`}
                onClick={() => clickable && onBarClick(d.date)}
                title={clickable ? `查看 ${label} 的测算记录` : undefined}
              >
                <span className="text-[10px] text-slate-500">{d.count > 0 ? d.count : ''}</span>
                <div
                  className={`rounded-t-sm transition-all ${
                    d.count > 0
                      ? 'bg-amber-400/70 group-hover:bg-amber-400 group-hover:shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                      : 'bg-white/[0.05]'
                  }`}
                  style={{ height: barH, width: '40%' }}
                />
                <span className={`text-[10px] transition-colors ${clickable ? 'text-slate-500 group-hover:text-amber-400/80' : 'text-slate-500'}`}>{label}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 text-[10px] text-slate-600 text-center">点击柱子查看当日测算明细</div>
      </div>
    </div>
  )
}
