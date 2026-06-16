import { useState } from 'react'
import AdminLayout, { type AdminTab } from './AdminLayout'
import OverviewPage from './OverviewPage'
import MessagesPage from './MessagesPage'
import UsersPage from './UsersPage'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('overview')
  // 从概览柱状图点击跳转时带的日期筛选
  const [filterDate, setFilterDate] = useState<string | null>(null)

  const handleTabChange = (t: AdminTab) => {
    // 切换 tab 时清空日期筛选（通过侧边栏点击）
    setFilterDate(null)
    setTab(t)
  }

  const handleBarClick = (date: string) => {
    setFilterDate(date)
    setTab('users')
  }

  return (
    <AdminLayout tab={tab} onTabChange={handleTabChange}>
      {tab === 'overview' && (
        <OverviewPage
          onTabChange={(t) => { setFilterDate(null); setTab(t) }}
          onBarClick={handleBarClick}
        />
      )}
      {tab === 'messages' && <MessagesPage />}
      {tab === 'users' && (
        <UsersPage
          filterDate={filterDate}
          onClearFilter={() => setFilterDate(null)}
        />
      )}
    </AdminLayout>
  )
}
