import { createHmac, timingSafeEqual } from 'crypto'

export function getAudioSignSecret(): string {
  const secret = process.env.AUDIO_SIGN_SECRET?.trim()
  if (!secret) throw new Error('缺少 AUDIO_SIGN_SECRET')
  return secret
}

export function signAudioUrl(file: string, exp: number): string {
  return createHmac('sha256', getAudioSignSecret())
    .update(`${file}&${exp}`)
    .digest('hex')
}

export function verifyAudioSig(file: string, exp: number, sig: string): boolean {
  const expected = signAudioUrl(file, exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const RELAX_AUDIO_FILES: Record<string, string> = {
  'training-modes': '放松准备与三种训练模式.m4a',
  'female-guidance': '放松引导女声30分钟.m4a',
  'deep-relaxation-fire': '深度放松引火下行进阶纯人声.m4a',
  'deep-relaxation-sanjiao': '深度放松三焦加长版.m4a',
  'deep-relaxation-30': '深度放松引导30分钟.m4a',
  'sleep-training-1': '松眠引导进阶秒睡训练1.m4a',
  'throat-relaxation': '舌咽部放松小节.m4a',
  'low-mood-relaxation': '情绪低落时的放松引导.m4a',
  'starship-sleep': '放松后入眠星舰版.m4a',
}

export function resolveRelaxAudioFile(audioId: string): string | null {
  return RELAX_AUDIO_FILES[audioId] || null
}
