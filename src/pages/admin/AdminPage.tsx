import { useState } from 'react'
import AdminLayout, { type AdminTab } from './AdminLayout'
import OverviewPage from './OverviewPage'
import MessagesPage from './MessagesPage'
import UsersPage from './UsersPage'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('overview')

  return (
    <AdminLayout tab={tab} onTabChange={setTab}>
      {tab === 'overview' && <OverviewPage />}
      {tab === 'messages' && <MessagesPage />}
      {(tab === 'users' || tab === 'points') && <UsersPage />}
    </AdminLayout>
  )
}
