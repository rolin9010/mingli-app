import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createReadStream, existsSync, statSync } from 'fs'
import { basename, join } from 'path'
import { verifyAudioSig } from './_signed.js'

const AUDIO_DIR = join(__dirname, '..', 'media', 'relax-audio')
const MIME = 'audio/mp4'

function parseRange(rangeHeader: string | undefined, size: number): [number, number] {
  if (!rangeHeader) return [0, size - 1]
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!match) return [0, size - 1]
  const start = match[1] ? parseInt(match[1], 10) : 0
  const end = match[2] ? parseInt(match[2], 10) : size - 1
  return [
    Math.min(start, size - 1),
    Math.min(end, size - 1),
  ]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const file = String(req.query.file || '')
  const exp = Number(req.query.exp || 0)
  const sig = String(req.query.sig || '')

  if (!file || !exp || !sig) return res.status(403).json({ error: 'MISSING' })
  if (Date.now() > exp) return res.status(403).json({ error: 'EXPIRED' })

  const name = basename(file)
  if (!name.endsWith('.m4a')) return res.status(403).json({ error: 'TYPE' })
  if (!verifyAudioSig(name, exp, sig)) return res.status(403).json({ error: 'BAD_SIG' })

  const target = join(AUDIO_DIR, name)
  if (!existsSync(target)) return res.status(404).json({ error: 'NOT_FOUND' })

  const stat = statSync(target)
  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined
  const [start, end] = parseRange(rangeHeader, stat.size)
  const partial = rangeHeader ? true : false

  res.status(partial ? 206 : 200)
  res.setHeader('Content-Type', MIME)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'no-store')
  if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  res.setHeader('Content-Length', end - start + 1)

  createReadStream(target, { start, end }).pipe(res)
}
