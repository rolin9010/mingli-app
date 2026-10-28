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

export interface RelaxAudioMeta {
  id: string
  title: string
  tag: string
  icon: string
  duration: number
  fileName: string
  free?: boolean
}

// 放松音频唯一清单：列表下发、播放鉴权、免费判定都以这里为准。
// 以后新增音频：在这里加一条 + 上传同名 .m4a 到 Blob 即可，小程序无需发版。
export const RELAX_AUDIO_CATALOG: RelaxAudioMeta[] = [
  { id: 'seated-relaxation', title: '坐位式放松', tag: '基础放松', icon: '◉', duration: 1206, fileName: 'seated-relaxation.m4a', free: true },
  { id: 'training-modes', title: '放松前准备和讲解：松眠训练法里三种不同的方式模式（可做白噪音听）', tag: '练习说明', icon: '◎', duration: 400, fileName: 'training-modes.m4a' },
  { id: 'female-guidance', title: '放松引导（女声）', tag: '基础引导', icon: '♪', duration: 1799, fileName: 'female-guidance.m4a' },
  { id: 'deep-relaxation-fire', title: '深度放松引火下行（进阶纯人声）', tag: '进阶引导', icon: '▽', duration: 2285, fileName: 'deep-relaxation-fire.m4a' },
  { id: 'deep-relaxation-sanjiao', title: '深度放松三焦加长版', tag: '进阶引导', icon: '∿', duration: 3185, fileName: 'deep-relaxation-sanjiao.m4a' },
  { id: 'deep-relaxation-30', title: '深度放松引导30分钟', tag: '深度放松', icon: '○', duration: 1799, fileName: 'deep-relaxation-30.m4a' },
  { id: 'sleep-training-1', title: '松眠引导进阶秒睡训练1', tag: '助眠训练', icon: '☾', duration: 1469, fileName: 'sleep-training-1.m4a' },
  { id: 'throat-relaxation', title: '舌咽部放松小节', tag: '局部放松', icon: '∴', duration: 212, fileName: 'throat-relaxation.m4a' },
  { id: 'low-mood-relaxation', title: '情绪低落和抑郁的放松引导', tag: '情绪舒缓', icon: '≈', duration: 790, fileName: 'low-mood-relaxation.m4a' },
  { id: 'starship-sleep', title: '放松后入眠（星舰版）', tag: '睡前入眠', icon: '✦', duration: 308, fileName: 'starship-sleep.m4a' },
  { id: 'anxiety-advanced-clean', title: '松眠引导进阶版（焦虑躯体化 · 无配乐清净版）', tag: '焦虑舒缓', icon: '◌', duration: 3211, fileName: 'anxiety-advanced-clean.m4a' },
  { id: 'anxiety-advanced-music', title: '松眠进阶放松引导（焦虑躯体化 · 配乐版）', tag: '焦虑舒缓', icon: '♪', duration: 3211, fileName: 'anxiety-advanced-music.m4a' },
  { id: 'anxiety-body-release', title: '松眠引导（焦虑躯体化松解练习）', tag: '躯体松解', icon: '∿', duration: 3211, fileName: 'anxiety-body-release.m4a' },
  { id: 'standing-guidance', title: '站桩引导', tag: '站桩引导', icon: '▮', duration: 3531, fileName: 'standing-guidance.m4a' },
]

export const RELAX_AUDIO_FILES: Record<string, string> = Object.fromEntries(
  RELAX_AUDIO_CATALOG.map((audio) => [audio.id, audio.fileName]),
)

export function resolveRelaxAudioFile(audioId: string): string | null {
  return RELAX_AUDIO_FILES[audioId] || null
}

// 免费试听（非会员也可播放）的放松音频 id
export const FREE_RELAX_AUDIO_IDS = new Set<string>(
  RELAX_AUDIO_CATALOG.filter((audio) => audio.free).map((audio) => audio.id),
)

export function isFreeRelaxAudio(audioId: string): boolean {
  return FREE_RELAX_AUDIO_IDS.has(audioId)
}

export function getRelaxAudioBlobPath(audioId: string): string | null {
  const file = resolveRelaxAudioFile(audioId)
  return file ? `media/relax-audio/${file}` : null
}

export function buildAudioStreamUrl(audioId: string, exp: number): string {
  const sig = signAudioUrl(audioId, exp)
  return `${AUDIO_STREAM_ORIGIN}/api/miniprogram-member?action=audio&file=${encodeURIComponent(audioId)}&exp=${exp}&sig=${sig}`
}
