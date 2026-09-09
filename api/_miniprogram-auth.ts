import { createHash } from 'crypto'
import type { VercelRequest } from '@vercel/node'

const validatedKeys = new Set<string>()

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function authorizeMiniProgramProxy(
  req: VercelRequest,
  supabaseUrl: string,
  configuredServiceKey: string,
) {
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return false
  if (token === configuredServiceKey) return true

  const keyFingerprint = fingerprint(token)
  if (validatedKeys.has(keyFingerprint)) return true

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) return false
    validatedKeys.add(keyFingerprint)
    return true
  } catch {
    return false
  }
}
