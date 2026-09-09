import { createHmac, timingSafeEqual } from 'crypto'

const AUDIO_STREAM_ORIGIN = process.env.AUDIO_URL_ORIGIN?.replace(/\/+$/, '') || 'https://wuxingme.cn'

export function getAudioSignSecret(): string {
  const secret = process.env.AUDIO_SIGN_SECRET?.trim()
  if (!secret) throw new Error('缺少 AUDIO_SIGN_SECRET')
  return secret
}

export function signAudioUrl(fileId: string, exp: number): string {
  return createHmac('sha256', getAudioSignSecret())
    .update(`${fileId}&${exp}`)
    .digest('hex')
}

export function verifyAudioSig(fileId: string, exp: number, sig: string): boolean {
  const expected = signAudioUrl(fileId, exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const RELAX_AUDIO_FILES: Record<string, string> = {
  'training-modes': 'training-modes.m4a',
  'female-guidance': 'female-guidance.m4a',
  'deep-relaxation-fire': 'deep-relaxation-fire.m4a',
  'deep-relaxation-sanjiao': 'deep-relaxation-sanjiao.m4a',
  'deep-relaxation-30': 'deep-relaxation-30.m4a',
  'sleep-training-1': 'sleep-training-1.m4a',
  'throat-relaxation': 'throat-relaxation.m4a',
  'low-mood-relaxation': 'low-mood-relaxation.m4a',
  'starship-sleep': 'starship-sleep.m4a',
}

export function resolveRelaxAudioFile(audioId: string): string | null {
  return RELAX_AUDIO_FILES[audioId] || null
}

export function getRelaxAudioBlobPath(audioId: string): string | null {
  const file = resolveRelaxAudioFile(audioId)
  return file ? `media/relax-audio/${file}` : null
}

export function buildAudioStreamUrl(audioId: string, exp: number): string {
  const sig = signAudioUrl(audioId, exp)
  return `${AUDIO_STREAM_ORIGIN}/api/miniprogram-member?action=audio&file=${encodeURIComponent(audioId)}&exp=${exp}&sig=${sig}`
}
