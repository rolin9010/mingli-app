import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export interface AdminContext {
  supabase: SupabaseClient
  user: User
}

function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? process.env.VITE_ADMIN_EMAILS ?? 'rolin9010@foxmail.com'
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function setAdminCors(res: VercelResponse, methods = 'GET, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AdminContext | null> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: '服务器配置错误' })
    return null
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: '未登录' })
    return null
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: '登录已失效' })
    return null
  }

  const email = user.email?.toLowerCase()
  if (!email || !adminEmails().includes(email)) {
    res.status(403).json({ error: '无管理员权限' })
    return null
  }

  return { supabase, user }
}
