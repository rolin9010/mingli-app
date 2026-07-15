import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, setAdminCors } from './_auth.js'

interface AdminAuthUser {
  id: string
  email: string
  created_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toAdminAuthUser(user: { id: string; email?: string; created_at?: string }): AdminAuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    created_at: user.created_at ?? '',
  }
}

function parseIds(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  return [...new Set(value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => UUID_RE.test(id)))]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setAdminCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const ids = parseIds(req.query.ids)
  const countOnly = req.query.countOnly === '1'

  try {
    if (ids.length > 0) {
      const results = await Promise.all(ids.map((id) => ctx.supabase.auth.admin.getUserById(id)))
      const users = results
        .map((result) => result.data.user)
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map(toAdminAuthUser)

      return res.status(200).json({ users, total: users.length })
    }

    const users: AdminAuthUser[] = []
    const perPage = 1000
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await ctx.supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error

      const pageUsers = data.users.map(toAdminAuthUser)
      users.push(...pageUsers)
      if (pageUsers.length < perPage) break
    }

    return res.status(200).json(countOnly ? { total: users.length } : { users, total: users.length })
  } catch (error) {
    console.error('admin users api error:', error)
    return res.status(500).json({ error: '管理员用户查询失败' })
  }
}
