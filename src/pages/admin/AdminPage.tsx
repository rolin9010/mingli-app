import { useState } from 'react'
import AdminLayout, { type AdminTab } from './AdminLayout'
import OverviewPage from './OverviewPage'
import MessagesPage from './MessagesPage'
import UsersPage from './UsersPage'
import PointsPage from './PointsPage'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('overview')

  return (
    <AdminLayout tab={tab} onTabChange={setTab}>
      {tab === 'overview' && <OverviewPage />}
      {tab === 'messages' && <MessagesPage />}
      {tab === 'users' && <UsersPage />}
      {tab === 'points' && <PointsPage />}
    </AdminLayout>
  )
}
