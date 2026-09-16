import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Solar } from 'lunar-javascript'
import { authorizeMiniProgramProxy } from './_miniprogram-auth.js'
import { flattenWeChatPublishedItems, normalizeManualArticles } from './_official-articles.js'

type OfficialArticle = {
  id: string
  title: string
  digest: string
  url: string
  publishedAt: number
}

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

let officialAccessTokenCache: CacheEntry<string> | null = null
let officialArticlesCache: CacheEntry<OfficialArticle[]> | null = null

function readManualOfficialArticles(): OfficialArticle[] {
  const raw = process.env.WECHAT_OA_ARTICLES_JSON
  if (!raw) return []
  try {
    return normalizeManualArticles(JSON.parse(raw)) as OfficialArticle[]
  } catch (error) {
    console.error('invalid WECHAT_OA_ARTICLES_JSON:', error)
    return []
  }
}

async function getOfficialAccessToken(appId: string, appSecret: string): Promise<string> {
  if (officialAccessTokenCache && officialAccessTokenCache.expiresAt > Date.now()) {
    return officialAccessTokenCache.value
  }

  const params = new URLSearchParams({
    grant_type: 'client_credential',
    appid: appId,
    secret: appSecret,
  })
  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${params}`)
  const data = await response.json() as {
    access_token?: string
    expires_in?: number
    errcode?: number
    errmsg?: string
  }
  if (!response.ok || !data.access_token) {
    throw new Error(`WeChat token failed: ${data.errcode ?? response.status} ${data.errmsg ?? ''}`.trim())
  }

  officialAccessTokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in ?? 7200) - 300) * 1000,
  }
  return data.access_token
}

async function fetchOfficialArticles(appId: string, appSecret: string): Promise<OfficialArticle[]> {
  if (officialArticlesCache && officialArticlesCache.expiresAt > Date.now()) {
    return officialArticlesCache.value
  }

  const accessToken = await getOfficialAccessToken(appId, appSecret)
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: 0, count: 20, no_content: 1 }),
    },
  )
  const data = await response.json() as {
    item?: unknown
    errcode?: number
    errmsg?: string
  }
  if (!response.ok || data.errcode) {
    if (data.errcode === 40014 || data.errcode === 42001) officialAccessTokenCache = null
    throw new Error(`WeChat articles failed: ${data.errcode ?? response.status} ${data.errmsg ?? ''}`.trim())
  }

  const articles = flattenWeChatPublishedItems(data.item) as OfficialArticle[]
  officialArticlesCache = { value: articles, expiresAt: Date.now() + 10 * 60 * 1000 }
  return articles
}

async function respondWithOfficialArticles(res: VercelResponse) {
  const manualArticles = readManualOfficialArticles()
  const appId = process.env.WECHAT_OA_APPID
  const appSecret = process.env.WECHAT_OA_APP_SECRET
  res.setHeader('Cache-Control', 'private, max-age=0')

  if (!appId || !appSecret) {
    return res.status(200).json({
      success: true,
      configured: manualArticles.length > 0,
      source: manualArticles.length > 0 ? 'manual' : 'unconfigured',
      articles: manualArticles,
    })
  }

  try {
    return res.status(200).json({
      success: true,
      configured: true,
      source: 'wechat',
      articles: await fetchOfficialArticles(appId, appSecret),
    })
  } catch (error) {
    console.error('official account articles fetch failed:', error)
    if (manualArticles.length > 0) {
      return res.status(200).json({
        success: true,
        configured: true,
        source: 'manual-fallback',
        articles: manualArticles,
      })
    }
    return res.status(502).json({ error: '公众号文章暂时无法加载' })
  }
}

const PERSONAL_REWRITE_SYSTEM_PROMPT = `你是“松眠小贴士”的文案编辑。服务端已完成私密资料计算，你只会收到一份匿名的当日练习草案。请在不改变个人节律结论和练习主线的前提下重写，让语言更自然、有温度，像一位熟悉松眠体系的老师写给当天的学员。

必须完整保留七个标题：个人节律画像、今天对你的影响、专属松眠练习、补足动作、工作生活建议、今夜收神、觉察与创造。“工作生活建议”下必须保留工作、生活、健康、饮食四行。总长度 650-950 个汉字。

写作规则：
1. 原样保留草案中的两个个人节律标签、主练习、补足动作、步骤、时长、工作、生活、健康、饮食建议和微小行动，不自行替换。
2. 体现“松而不懈、收神归位、身体信号值得倾听、放松后回到微小创造”，但不要像口号。
3. 不添加姓名、生日、性别、比例、元素名称、排盘、运势或其他计算术语。
4. 不做疾病、脏腑、经络或情绪原因判断；不推荐药物、穴位或食疗，不承诺疗效。饮食只谈进食节律、温度、水分、清淡度和刺激物控制。
5. 呼吸保持自然，不屏息、不强求深长。疼痛、头晕、胸闷或呼吸不适时应停止。
6. 不用 Markdown 星号，不重复标题或同一句意思。`

const BLOCKED_TERMS = /\u4e94\u884c|\u547d\u7406|\u516b\u5b57|\u7b97\u547d|\u7b97\u5366|\u8fd0\u52bf|\u5409\u51f6|\u56db\u67f1|\u5929\u5e72|\u5730\u652f|\u6d41\u65e5/gu
const GARBLED_TEXT_PATTERN = /\uFFFD|\u951f\u65a4\u62f7|\?{3,}/u
const INTERNAL_DRAFT_INSTRUCTION_PATTERN = /表达变体编号\s*[：:]\s*[0-9a-z_-]+[。.]?\s*请重写以下匿名练习草案\s*[：:]?/giu
type ElementName = '木' | '火' | '土' | '金' | '水'

type PersonalTipMeta = {
  seasonLabel: string
  primaryLabel: string
  supportLabel: string
  profileSummary: string
  interplay: string
}

const ELEMENTS: ElementName[] = ['木', '火', '土', '金', '水']
const SEASONAL_ELEMENT_WEIGHTS: Record<string, Record<ElementName, number>> = {
  春季: { 木: 6, 火: 3, 水: 0, 金: -3, 土: -5 },
  夏季: { 火: 6, 土: 3, 木: 0, 水: -3, 金: -5 },
  秋季: { 金: 6, 水: 3, 土: 0, 火: -3, 木: -5 },
  冬季: { 水: 6, 木: 3, 金: 0, 土: -3, 火: -5 },
  四季调养: { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 },
}

const ELEMENT_PRACTICE_DIRECTIONS: Record<ElementName, string> = {
  木: '舒展：优先动态松塔或慢走，结束后写下一个真正想推进的小步骤。',
  火: '降速：优先整体呼吸或太极云手，把向外的兴奋逐步收回。',
  土: '承托：优先身体扫描或自然站立，重新感受脚底、坐骨和支撑面。',
  金: '收敛：优先五步接收法或八段锦的缓慢开合，练习放下一件不再需要的事。',
  水: '蓄能：优先静态松塔或短时慢走收功，少做一件消耗性任务。',
}

const ELEMENT_PRESENTATION: Record<ElementName, {
  label: string
  tendency: string
  supportNeed: string
}> = {
  木: {
    label: '生发',
    tendency: '注意力更容易放在推进、展开和下一步',
    supportNeed: '需要补一点舒展感和明确方向',
  },
  火: {
    label: '温煦',
    tendency: '注意力更容易停留在交流、响应和向外表达',
    supportNeed: '需要补一点温度、活力和真实表达',
  },
  土: {
    label: '承托',
    tendency: '注意力更容易放在承担、照顾和维持稳定',
    supportNeed: '需要补一点支撑感、规律和落地感',
  },
  金: {
    label: '收敛',
    tendency: '注意力更容易放在边界、判断和如何结束',
    supportNeed: '需要补一点边界、取舍和结束感',
  },
  水: {
    label: '涵养',
    tendency: '注意力更容易回到内在、停顿和保留精力',
    supportNeed: '需要补一点停顿、安静和恢复空间',
  },
}

const SUPPORT_MICRO_PRACTICES: Record<ElementName, string> = {
  木: '主练结束后站起来，小幅度展开肩胛和手臂两分钟；再写下一个明天可以开始的小步骤，只写一个。',
  火: '主练结束后把双手轻放在大腿上，回想今天一个让你感到温暖的瞬间；如果愿意，向一个人表达一句真实的感谢。',
  土: '主练结束后安静站立两分钟，感受脚底、椅子或地面的支撑；然后只整理手边一小块区域。',
  金: '主练结束后把一件未完成的事写进明日清单，并对今天明确说一句“先到这里”，不再继续处理。',
  水: '主练结束后留出两分钟无输入时间：不看手机，不听内容，只感受呼吸和身体的支撑面。',
}

type PersonalBalancePlan = {
  pace: string
  practiceName: string
  practice: string
  movement: string
  movementGuide: string
}

const PERSONAL_BALANCE_PLANS: Record<ElementName, PersonalBalancePlan> = {
  木: {
    pace: '你今天更适合“先定中心，再向外舒展”。有行动力是好事，但不必把每一股劲都变成新任务；留一点余地，反而更容易辨认真正想做的事。',
    practiceName: '动态松塔',
    practice: '在办公椅上坐稳，先感受脚底和坐骨；再用很小的幅度松开骨盆、肩胛、肘和手指；最后让脊柱像树干一样自然向上延展。做八分钟，不追求幅度。',
    movement: '慢走收功',
    movementGuide: '慢走十分钟，最后两分钟放慢脚步，把注意力从目标带回当下。',
  },
  火: {
    pace: '你今天更适合“把向外的亮度缓缓调低”。不需要突然停机，而是从快到慢、从交流到安静，给身体一段看得见的过渡。',
    practiceName: '整体呼吸',
    practice: '坐稳后先松开下颌、肩膀和双手；只观察自然呼吸，每次呼气时让身体多交给椅子一点。做八分钟，不憋气，不刻意深呼吸。',
    movement: '太极云手',
    movementGuide: '左右缓慢移动重心五分钟，肩肘保持松沉，再安静站立一分钟。',
  },
  土: {
    pace: '你今天更需要的不是继续承担，而是确认什么正在承托你。当身体重新感到地面、椅子和床的支撑，注意力才不必一直悬在未完成的事上。',
    practiceName: '身体八层扫描',
    practice: '依次觉察脚、膝、髋、腰背与脊柱、胸肩、手臂、颈部和头面。每到一层，先感受它与支撑面的接触，再减掉一点不必要的用力。做十分钟。',
    movement: '自然站立',
    movementGuide: '双脚自然分开，膝盖保持弹性，感受脚底的重量三到五分钟，不把身体站僵。',
  },
  金: {
    pace: '你今天适合练习“收敛但不紧缩”。真正的边界不是把自己绷住，而是看清什么要留下，什么可以暂时放下。',
    practiceName: '五步接收法',
    practice: '找到当下最明显的一处身体感受，依次允许它存在、用中性词命名、确认位置、安静陪伴，最后感谢它带来信息。做八到十分钟，不分析原因。',
    movement: '八段锦',
    movementGuide: '选两到三式慢练八分钟，每个开合都留有余地，练完不立即刷手机。',
  },
  水: {
    pace: '你今天更适合“先蓄能，再做一件小事”。静下来不是躺平，而是把散在外面的力量收回来，避免在疲惫时继续做无序输出。',
    practiceName: '静态松塔',
    practice: '躺好后先确认身体有稳定支撑，再从脚底、双腿、骨盆、腰背、胸肩、双手到头面逐层放松。不命令某处立刻松开，只告诉它现在可以休息。做十到十二分钟。',
    movement: '慢走收功',
    movementGuide: '在安全环境慢走八分钟，不追求速度和出汗，最后站定感受手脚。',
  },
}

const PERSONAL_SUPPORT_ACTIONS: Record<ElementName, { question: string; action: string }> = {
  木: { question: '放松后，我真正想推进的是哪一件事？', action: '只写下它的第一个小步骤。' },
  火: { question: '今天哪一段交流让我变得更明亮，哪一段让我过度消耗？', action: '向一个人表达一句真实的感谢或感受。' },
  土: { question: '此刻有什么正在稳稳地支持我？', action: '整理一块小区域，或为自己准备一份简单餐食。' },
  金: { question: '今天哪一件事可以在这里结束？', action: '清理一件不再需要的物品，或温和地说一次“先到这里”。' },
  水: { question: '今天哪一项消耗其实可以不做？', action: '为自己留出十分钟无输入、无任务的安静时间。' },
}

const PERSONAL_NIGHT_PLANS: Record<ElementName, string> = {
  木: '今晚先把明天最想推进的事写成一个小步骤，然后告诉自己“今天不再继续往前赶”。躺下后从双脚开始扫描，让向外的力量逐层收回。',
  火: '睡前二十分钟停止高强度交流和信息刷新，调暗屏幕与房间光线。躺好后先松开牙关、下颌和肩膀，只观察自然呼吸，不追求立即睡着。',
  土: '睡前先处理一个很小的环境细节，比如收好杯子或整理床边，然后就停止收拾。躺下后感受床垫对脚、骨盆和后背的承托，不再靠自己“撑住”。',
  金: '睡前把一件未完成的事写进明日清单，写完即结束处理。然后关闭多余页面、调暗光线，用三个自然呼气感受肩胛和双手松开，给今天一个边界。',
  水: '今晚把手机放到伸手不能直接取到的地方，少一轮无目的的信息输入。躺好后让呼吸自己运行，只感受身体和支撑面的接触，把“必须睡着”也暂时放下。',
}

type DailyLifeGuidance = {
  work: string
  life: string
  health: string
  diet: string
}

const SEASONAL_LIFE_GUIDANCE: Record<string, DailyLifeGuidance> = {
  春季: {
    work: '时令由藏转生，把最需启动的事放在前半天，下午留出收束时间。',
    life: '给房间和日程留一点通风感，但不要一次添加过多新安排。',
    health: '以小幅舒展和慢走为主，从轻到稍活动，不用高强度补偿久坐。',
    diet: '保持三餐规律，选择当季蔬菜和简单家常饭，少边工作边匆忙进食。',
  },
  夏季: {
    work: '白昼较长、外放感较强，重点任务尽量前置，晚间不再开新任务。',
    life: '为社交和信息输入设一个明确结束点，从热闹回到安静要有过渡。',
    health: '活动以不打乱自然呼吸为准，炎热时减少长时间户外强度训练。',
    diet: '主动饮水并正常吃饭，不用大量冰饮、浓咖啡或高刺激食物代替休息。',
  },
  秋季: {
    work: '时令由外放转向收敛，先完成和归档已开始的事，少在今天同时铺开多条新线。',
    life: '减少无目的信息刷新，清理一个小空间即可，不把整理变成新负担。',
    health: '练习重点放在肩颈、牙关、双手和呼吸节律，动作稳定而不僵硬。',
    diet: '留意日常饮水，优先规律、温和、不过饱的一餐，晚间减少过咸过辣和酒精刺激。',
  },
  冬季: {
    work: '时令重在收藏蓄能，今天安排少而关键的任务，不靠拉长工作时间证明效率。',
    life: '把温暖、光线和安静当作休息条件，早一点结束不必要的外出和消耗。',
    health: '以室内慢走、自然站立和静态放松为主，身体明显疲惫时就停。',
    diet: '优先温热、易安排的正常餐食，避免晚间过饱，也不用糖分或咖啡因硬撑精神。',
  },
  四季调养: {
    work: '节律转换时，只保留一件最重要的工作，其他任务按体力和时间递减。',
    life: '先观察今天是需要舒展还是收回，再决定社交、出行和信息输入的量。',
    health: '选择强度可随时降低的温和活动，呼吸不顺或身体不适时立即停止。',
    diet: '以规律、温和、不过饱为主，根据实际饥饱感调整，不跟风极端限制。',
  },
}

const PRIMARY_LIFE_GUIDANCE: Record<ElementName, DailyLifeGuidance> = {
  木: {
    work: '你的推进感较明显，把新想法收成一个可交付结果，不再继续开支线。',
    life: '临时想做的事先记下，今天只选一件落地。',
    health: '久坐后做小幅度展肩、松髋和慢走，给向外的力量一个有边界的出口。',
    diet: '进食时放慢速度，不在赶进度时草草吃完。',
  },
  火: {
    work: '你对交流和外界反馈更敏感，集中处理沟通，别让消息整天切断深度任务。',
    life: '给社交安排一个结束时间，回到家后先降低声光刺激。',
    health: '从松开下颌、肩膀和双手开始，用慢动作而非高强度训练完成降速。',
    diet: '晚间减少浓咖啡、酒精和过度辛辣，别让味觉刺激延长白天的兴奋。',
  },
  土: {
    work: '你容易继续承接别人的任务，今天先写清自己的职责边界，至少延后一件非紧急请求。',
    life: '整理一个小区域后就停，把“全部弄好”改成“今天已经够稳定”。',
    health: '多感受脚底、坐骨和背部的支撑，每工作一段时间就起身站立两分钟。',
    diet: '把正餐时间固定下来，先坐稳再吃，不靠零食一直延后正常进食。',
  },
  金: {
    work: '你对规则和细节更敏感，今天优先收尾和交付，给修改次数设一个上限。',
    life: '清理一件不再需要的物品或信息，然后明确停止，不延伸成大扫除。',
    health: '留意牙关、肩胛和手指是否一直用力，用小幅开合代替用力拉伸。',
    diet: '让每餐都有明确的开始和结束，饭后不用持续零食填满停顿。',
  },
  水: {
    work: '你更容易先保留精力，把任务拆成十分钟可启动的第一步，不等状态完美再开始。',
    life: '安静之外也要保留一点和现实世界的连接，比如短时慢走或完成一件小家务。',
    health: '先静态放松，再做少量温和活动，不用突然提高强度来“唤醒”自己。',
    diet: '保持温和、规律的进食，不用糖分和咖啡因掩盖需要休息的信号。',
  },
}

const SUPPORT_LIFE_GUIDANCE: Record<ElementName, DailyLifeGuidance> = {
  木: { work: '留一个明确的启动步骤。', life: '安排一次短时舒展或户外慢走。', health: '加两分钟小幅展肩和松髋。', diet: '正餐里保留一份当季蔬菜。' },
  火: { work: '安排一次清晰、简短的沟通。', life: '主动表达一句真实感受。', health: '在安全范围内加一点温和的活动感。', diet: '选择温度舒适、不过度冰冷的正常餐食。' },
  土: { work: '先确定顺序和截止时间。', life: '为当天留一个稳定的日常锚点。', health: '多感受脚底和支撑面。', diet: '优先规律吃一顿完整正餐。' },
  金: { work: '完成一个明确交付并就此结束。', life: '清理一件不再需要的物品。', health: '用三个自然呼气感受肩胛和双手松开。', diet: '减少过咸和无意识的连续零食。' },
  水: { work: '减少一项可以延后的消耗。', life: '留出十分钟无输入时间。', health: '练习后安静坐或躺两分钟。', diet: '晚间减少咖啡因、酒精和过饱。' },
}

export function buildPersonalLifeGuidance(
  elements: { element: string; percent: number }[],
  today: ReturnType<typeof getShanghaiToday>,
): DailyLifeGuidance {
  const assessment = getSeasonalElementAssessment(elements, today.season)
  const seasonal = SEASONAL_LIFE_GUIDANCE[today.season] || SEASONAL_LIFE_GUIDANCE['四季调养']
  const primary = PRIMARY_LIFE_GUIDANCE[assessment.dominant]
  const support = SUPPORT_LIFE_GUIDANCE[assessment.support]
  const supportLabel = ELEMENT_PRESENTATION[assessment.support].label
  const combine = (key: keyof DailyLifeGuidance) => (
    `${seasonal[key]}${primary[key]}为了同时照顾“${supportLabel}”节律，${support[key]}`
  )
  return {
    work: combine('work'),
    life: combine('life'),
    health: combine('health'),
    diet: combine('diet'),
  }
}

const PERSONAL_SEASON_CONTEXT: Record<string, string> = {
  春季: '当下时令由藏转生，练习要有舒展感，但不用猛然增加强度。',
  夏季: '当下时令偏向外放，今天要主动安排从忙碌到安静的过渡。',
  秋季: '当下时令由外放转向收敛，宜减少无效消耗，把注意力带回身体边界。',
  冬季: '当下时令重在收藏蓄能，不用高强度刺激代替真正的休息。',
  四季调养: '节律正在转换，先观察身体的真实需要，再决定今天练习的强度。',
}

type PublicPlan = {
  rhythm: string
  method: string
  practice: string
  movement: string
  movementGuide: string
  night: string
}

const PUBLIC_SEASON_PLANS: Record<string, PublicPlan[]> = {
  春季: [
    {
      rhythm: '传统四时把春看作由藏转生的阶段。今天的重点不是用力“打开”，而是像树枝一样有方向地舒展，松而不懈。',
      method: '动态松塔',
      practice: '坐好或站好，先感受脚底的支撑；再用小幅度松开髋、肩、肘和手指；最后让脊柱自然向上延展。全程八分钟，以呼吸不乱、动作留有余地为准。',
      movement: '慢走收功',
      movementGuide: '用能轻松说话的速度走十分钟，最后一分钟放慢脚步，把注意力收回脚底。',
      night: '睡前先写下明天最想推进的一个小步骤，再从脚到头扫描一遍身体。不急着睡着，只把白天散在外面的注意力带回来。',
    },
    {
      rhythm: '春日的“生”不等于把行程塞满。真正的舒展是先找回身体的中心，再决定今天把力量用在哪里。',
      method: '五步接收法',
      practice: '找到此刻最明显的一处感受，依次练习允许它存在、用中性词命名、确认它的位置、安静陪伴，最后感谢它带来信息。练习十分钟，不强求感受消失。',
      movement: '舒缓导引',
      movementGuide: '做小幅度转肩、展臂和松髋，每个动作停两个自然呼吸，六分钟即可。',
      night: '今晚把一件未完成的事放进明日清单，然后问自己：今天哪一刻，我的身体曾经真正松下来？',
    },
  ],
  夏季: [
    {
      rhythm: '夏日对应向外伸展的节律，白昼较长，人也容易把“还在运转”带到夜里。今天要给身体一个清晰的降速过程。',
      method: '整体呼吸',
      practice: '坐稳后放松下颌，让双手和肩膀不再主动用力；只观察自然呼吸，每次呼气时感受身体多交给椅子一点。做六到八分钟，不憋气，也不刻意深呼吸。',
      movement: '太极云手',
      movementGuide: '左右缓慢移动重心五分钟，肩肘保持松沉；出现头晕、疼痛或呼吸不适就立即停止。',
      night: '睡前二十分钟调暗屏幕和房间光线，再做一轮面部、肩胛、双手的放松。白天向外打开，夜晚就有意识地收回来。',
    },
    {
      rhythm: '外界越热闹，越需要为自己留一段不被信息牵走的时间。松眠不是立即停机，而是从快到慢、从外到内的切换。',
      method: '椅子上的动态松塔',
      practice: '双脚平放地面，先觉察牙关、肩膀和腰背是否在偷偷用力；然后轻轻活动骨盆、肩胛和手指；最后静坐一分钟。全程八分钟，动作小到不影响自然呼吸。',
      movement: '慢走收功',
      movementGuide: '傍晚慢走八到十分钟，最后两分钟降低速度，让脚步、呼吸和视线一起慢下来。',
      night: '今晚结束一次交谈或工作后，不要立即刷新的内容。把手放在大腿上坐一分钟，再写下今天值得保留的一个瞬间。',
    },
  ],
  秋季: [
    {
      rhythm: '传统四时把秋看作从生长转向收敛的阶段。今天不必再给自己叠加任务，先把注意力从过多的人和事上收回一点。',
      method: '身体八层扫描',
      practice: '坐好或躺好，依次觉察脚、膝、髋、腰背与脊柱、胸肩、手臂、颈部和头面。每到一层只做两件事：看见感受，再减少一点不必要的用力。全程十分钟。',
      movement: '八段锦',
      movementGuide: '选两到三式慢练八分钟，不憋气，不追求最大幅度；练完后安静站立三个自然呼吸。',
      night: '睡前清理桌面上的一件旧物，再把一件今天无法结束的事写下来。记录不是继续处理，而是告诉身体：这件事已有安放之处。',
    },
    {
      rhythm: '秋的“收”不是紧缩，而是辨认什么值得留下，什么可以放下。今天先把身体的边界感找回来，再回应外界。',
      method: '五步接收法',
      practice: '从肩颈、牙关或双手中找到最明显的一处感受；允许它在，用“紧、重、热、空”这类中性词命名，然后定位、陪伴、感谢。八分钟后只记录变化，不做原因推断。',
      movement: '自然站立',
      movementGuide: '双脚自然分开，膝盖不锁死，感受脚底和地面的接触三到五分钟。以稳定而不僵硬为准。',
      night: '今晚比平时提前十分钟结束信息输入。问自己：我今天能温和地向哪一件事说“先到这里”？',
    },
  ],
  冬季: [
    {
      rhythm: '传统四时把冬看作收藏与蓄能的阶段。今天的松眠不求“练到位”，只需把散在外面的能量一层层收回身体。',
      method: '静态松塔',
      practice: '躺好后先确认身体有稳定支撑，再从脚底、双腿、骨盆、腰背、胸肩、双手到头面逐层放松。不命令某处立刻松开，只告诉它现在可以休息。全程十到十二分钟。',
      movement: '室内慢走',
      movementGuide: '在温暖、安全的环境慢走八分钟，不追求出汗；最后站定，感受手脚和呼吸的状态。',
      night: '睡前把手机放到伸手不能直接取到的地方，调暗光线，让呼吸自己运行。今晚不必用“必须睡着”继续消耗自己。',
    },
    {
      rhythm: '冬日的“藏”不是停滞，而是为下一次行动保留可用的力量。今天宜少一点过度输出，多一点安静、温暖和稳定支撑。',
      method: '觉察记录',
      practice: '安静坐三分钟，依次写下此刻身体最紧、最松和最需要被照顾的三个位置；再选一处做五分钟的安静陪伴。记录是把模糊感受变成可回应的信息，不是自我诊断。',
      movement: '自然站立',
      movementGuide: '双脚站稳三分钟，手臂自然下垂，膝盖保持弹性；感到冷、头晕或明显疲劳就停下休息。',
      night: '今晚提前停止一项可以延后的任务，然后问自己：收回来的这一点精力，明天我想用来创造什么？',
    },
  ],
}
const SEASON_BY_TERM: Record<string, string> = {
  立春: '春季', 雨水: '春季', 惊蛰: '春季', 春分: '春季', 清明: '春季', 谷雨: '春季',
  立夏: '夏季', 小满: '夏季', 芒种: '夏季', 夏至: '夏季', 小暑: '夏季', 大暑: '夏季',
  立秋: '秋季', 处暑: '秋季', 白露: '秋季', 秋分: '秋季', 寒露: '秋季', 霜降: '秋季',
  立冬: '冬季', 小雪: '冬季', 大雪: '冬季', 冬至: '冬季', 小寒: '冬季', 大寒: '冬季',
}

type TipKind = 'public' | 'personal'

type GeneratedTip = {
  content: string
  usage: Record<string, number>
}

type TipProfile = {
  elements: { element: string; percent: number }[]
  updatedAt: string
}

export function getShanghaiToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  }).formatToParts(now)
  const values: Record<string, string> = {}
  parts.forEach((part) => {
    if (part.type !== 'literal') values[part.type] = part.value
  })
  const year = Number(values.year)
  const monthNumber = Number(values.month)
  const dayNumber = Number(values.day)
  const month = String(monthNumber).padStart(2, '0')
  const day = String(dayNumber).padStart(2, '0')
  const solarTerm = getSolarTermContext(year, monthNumber, dayNumber)

  return {
    dateKey: `${year}${month}${day}`,
    dateIso: `${year}-${month}-${day}`,
    dateStr: `${year}年${monthNumber}月${dayNumber}日`,
    weekday: values.weekday || '',
    season: solarTerm.season,
    solarTerm: solarTerm.name,
    nextSolarTerm: solarTerm.nextName,
    daysUntilNextTerm: solarTerm.daysUntilNext,
    isSolarTermDay: solarTerm.isExactDay,
  }
}

function daysBetween(fromYmd: string, toYmd: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.max(0, Math.round((parse(toYmd) - parse(fromYmd)) / 86_400_000))
}

export function getSolarTermContext(year: number, month: number, day: number) {
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const previous = lunar.getPrevJieQi(true)
  const next = lunar.getNextJieQi(true)
  const name = previous?.getName() || '当令'
  const todayYmd = solar.toYmd()
  const nextYmd = next?.getSolar().toYmd() || todayYmd
  return {
    name,
    nextName: next?.getName() || name,
    season: SEASON_BY_TERM[name] || '四季调养',
    daysUntilNext: daysBetween(todayYmd, nextYmd),
    isExactDay: lunar.getJieQi() === name,
  }
}

export function getDailyPracticeFocus(dateKey: string, season = '四季调养') {
  const plans = PUBLIC_SEASON_PLANS[season] || PUBLIC_SEASON_PLANS['秋季']
  const numericDate = Number(dateKey.slice(-2)) || 0
  const plan = plans[numericDate % plans.length]
  return { method: plan.method, movement: plan.movement }
}

function getPublicPlan(dateKey: string, season: string) {
  const plans = PUBLIC_SEASON_PLANS[season] || PUBLIC_SEASON_PLANS['秋季']
  const numericDate = Number(dateKey.slice(-2)) || 0
  return plans[numericDate % plans.length]
}

export function getSeasonalElementAssessment(
  elements: { element: string; percent: number }[],
  season: string,
) {
  const profileValues = Object.fromEntries(ELEMENTS.map((element) => [element, 0])) as Record<ElementName, number>
  elements.forEach((item) => {
    if (ELEMENTS.includes(item.element as ElementName) && Number.isFinite(item.percent)) {
      profileValues[item.element as ElementName] = Number(item.percent)
    }
  })
  const weights = SEASONAL_ELEMENT_WEIGHTS[season] || SEASONAL_ELEMENT_WEIGHTS['四季调养']
  const ranked = ELEMENTS.map((element) => ({
    element,
    raw: profileValues[element],
    seasonalWeight: weights[element],
    adjusted: profileValues[element] + weights[element],
  })).sort((a, b) => b.adjusted - a.adjusted)
  const dominant = ranked[0]
  const support = ranked[ranked.length - 1]
  return {
    dominant: dominant.element,
    support: support.element,
    spread: Number((dominant.adjusted - support.adjusted).toFixed(1)),
    dominantDirection: ELEMENT_PRACTICE_DIRECTIONS[dominant.element],
    supportDirection: ELEMENT_PRACTICE_DIRECTIONS[support.element],
    internalSummary: `${season}时令加权后，${dominant.element}向较突出，${support.element}向相对需要照顾，差值${(dominant.adjusted - support.adjusted).toFixed(1)}。`,
  }
}

export function buildPersonalAdaptationContext(
  elements: { element: string; percent: number }[],
  today: ReturnType<typeof getShanghaiToday>,
) {
  const assessment = getSeasonalElementAssessment(elements, today.season)
  return [
    `时令：${today.season}·${today.solarTerm}，传统四时节律参考“春生、夏长、秋收、冬藏”。`,
    `内部适配结果：${assessment.internalSummary}`,
    `较突出方向的平衡建议：${assessment.dominantDirection}`,
    `相对需要照顾的方向：${assessment.supportDirection}`,
    '请从两个方向中选择一个作为今日主线，另一个只放进“觉察与创造”，不要堆叠多种练习。',
  ].join('\n')
}

export function buildPersonalTipMeta(
  elements: { element: string; percent: number }[],
  today: ReturnType<typeof getShanghaiToday>,
): PersonalTipMeta {
  const assessment = getSeasonalElementAssessment(elements, today.season)
  const primary = ELEMENT_PRESENTATION[assessment.dominant]
  const support = ELEMENT_PRESENTATION[assessment.support]
  const seasonAction = today.season === '春季'
    ? '外在节律正在向生长和舒展倾斜'
    : today.season === '夏季'
      ? '外在节律正在向活跃和外放倾斜'
      : today.season === '秋季'
        ? '外在节律正在向收拢和减少消耗倾斜'
        : '外在节律正在向收藏和保留精力倾斜'

  return {
    seasonLabel: `${today.season}·${today.solarTerm}`,
    primaryLabel: primary.label,
    supportLabel: support.label,
    profileSummary: `你的个人节律中“${primary.label}”较突出，“${support.label}”是今天需要优先照顾的部分。`,
    interplay: `${today.solarTerm}阶段，${seasonAction}；而你${primary.tendency}，同时${support.supportNeed}。因此今天的方案会先平衡“${primary.label}”，再补足“${support.label}”，不是通用模板。`,
  }
}

export function buildPersonalSongmianTip(
  elements: { element: string; percent: number }[],
  today: ReturnType<typeof getShanghaiToday>,
) {
  const assessment = getSeasonalElementAssessment(elements, today.season)
  const balance = PERSONAL_BALANCE_PLANS[assessment.dominant]
  const support = PERSONAL_SUPPORT_ACTIONS[assessment.support]
  const meta = buildPersonalTipMeta(elements, today)
  const seasonContext = PERSONAL_SEASON_CONTEXT[today.season] || PERSONAL_SEASON_CONTEXT['四季调养']
  const lifeGuidance = buildPersonalLifeGuidance(elements, today)
  return `个人节律画像\n${meta.profileSummary}\n\n今天对你的影响\n${meta.interplay}${seasonContext}${balance.pace}\n\n专属松眠练习\n今天主练${balance.practiceName}：${balance.practice}这一步用来平衡今天较突出的“${meta.primaryLabel}”节律。若出现疼痛、头晕、胸闷或呼吸不适，立即停止。\n\n补足动作\n针对今天需要照顾的“${meta.supportLabel}”节律：${SUPPORT_MICRO_PRACTICES[assessment.support]}如仍想活动，可选${balance.movement}：${balance.movementGuide}\n\n工作生活建议\n工作：${lifeGuidance.work}\n生活：${lifeGuidance.life}\n健康：${lifeGuidance.health}\n饮食：${lifeGuidance.diet}\n\n今夜收神\n${PERSONAL_NIGHT_PLANS[assessment.dominant]}\n\n觉察与创造\n练习后记一句：“${support.question}”${support.action}松眠不是停在原地，而是把收回来的精力，用到一件真正重要的小事上。`
}

export function buildPublicSongmianTip(today: ReturnType<typeof getShanghaiToday>) {
  const plan = getPublicPlan(today.dateKey, today.season)
  const termStage = today.isSolarTermDay
    ? `今天正逢${today.solarTerm}`
    : `当前处于${today.solarTerm}节气阶段，距离${today.nextSolarTerm}约${today.daysUntilNextTerm}天`
  const quickPractice = plan.practice.split('。').slice(0, 2).filter(Boolean).join('。')
  const nightReminder = plan.night.split('。')[0]
  return `今日时令　${today.season}，${termStage}。${plan.rhythm}\n\n3分钟通用练习　今天可以从${plan.method}开始：${quickPractice}。做到身体稳定、呼吸自然即可。\n\n今夜一句　${nightReminder}。`
}

export function sanitizeDailyTip(content: string) {
  return String(content || '')
    .replace(INTERNAL_DRAFT_INSTRUCTION_PATTERN, '')
    .replace(/\uFFFD+/gu, '')
    .replace(/\u951f\u65a4\u62f7/gu, '')
    .replace(/\?{3,}/gu, '')
    .replace(BLOCKED_TERMS, '传统智慧')
    .replace(/\*\*/g, '')
    .replace(/(?:今日时令[：:\s]*){2,}/gu, '今日时令\n')
    .replace(/(?:今日节律[：:\s]*){2,}/gu, '今日节律\n')
    .replace(/(?:松眠练习[：:\s]*){2,}/gu, '松眠练习\n')
    .replace(/(?:今日适配[：:\s]*){2,}/gu, '今日适配\n')
    .replace(/(?:个人节律画像[：:\s]*){2,}/gu, '个人节律画像\n')
    .replace(/(?:今天对你的影响[：:\s]*){2,}/gu, '今天对你的影响\n')
    .replace(/(?:专属松眠练习[：:\s]*){2,}/gu, '专属松眠练习\n')
    .replace(/(?:补足动作[：:\s]*){2,}/gu, '补足动作\n')
    .replace(/(?:工作生活建议[：:\s]*){2,}/gu, '工作生活建议\n')
    .replace(/(?:放松方式[：:\s]*){2,}/gu, '放松方式\n')
    .replace(/(?:传统导引[：:\s]*){2,}/gu, '传统导引\n')
    .replace(/(?:传统运动[：:\s]*){2,}/gu, '传统运动\n')
    .replace(/(?:今夜收神[：:\s]*){2,}/gu, '今夜收神\n')
    .replace(/(?:今夜准备[：:\s]*){2,}/gu, '今夜准备\n')
    .replace(/(?:入睡准备[：:\s]*){2,}/gu, '入睡准备\n')
    .replace(/(?:觉察与创造[：:\s]*){2,}/gu, '觉察与创造\n')
    .replace(/(?:觉察记录[：:\s]*){2,}/gu, '觉察记录\n')
    .trim()
}

export function containsGarbledText(content: string) {
  return GARBLED_TEXT_PATTERN.test(String(content || ''))
}

export function isCompleteDailyTip(content: string, kind: TipKind) {
  const markers = kind === 'public'
    ? ['今日时令', '3分钟通用练习', '今夜一句']
    : ['个人节律画像', '今天对你的影响', '专属松眠练习', '补足动作', '工作生活建议', '工作：', '生活：', '健康：', '饮食：', '今夜收神', '觉察与创造']
  const plainLength = content.replace(/\s/gu, '').length
  const minimumLength = kind === 'public' ? 150 : 560
  return !containsGarbledText(content) && markers.every((marker) => content.includes(marker)) && plainLength >= minimumLength
}

function normalizeProfile(row: Record<string, unknown> | null): TipProfile | null {
  if (!row || !Array.isArray(row.elements)) return null
  const elements = row.elements.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const value = item as Record<string, unknown>
    const element = typeof value.element === 'string' ? value.element.trim() : ''
    const percent = Number(value.percent)
    if (!element || !Number.isFinite(percent)) return []
    return [{ element, percent }]
  })
  if (elements.length === 0) return null
  return {
    elements,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  }
}

async function polishPersonalTip(
  draft: string,
  userId: string,
  apiKey: string,
): Promise<GeneratedTip> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: PERSONAL_REWRITE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: draft,
        },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.76,
      max_tokens: 1_500,
      user_id: userId,
    }),
  })

  const text = await response.text()
  if (!response.ok) throw new Error(`AI 服务错误 ${response.status}: ${text.slice(0, 160)}`)
  const data = JSON.parse(text) as {
    choices?: { finish_reason?: string; message?: { content?: string } }[]
    usage?: Record<string, number>
  }
  const rawContent = data.choices?.[0]?.message?.content || ''
  if (containsGarbledText(rawContent)) throw new Error('个性化松眠小贴士返回乱码')
  const content = sanitizeDailyTip(rawContent)
  if (data.choices?.[0]?.finish_reason === 'length' || !isCompleteDailyTip(content, 'personal')) {
    throw new Error('个性化松眠小贴士返回不完整')
  }
  return { content, usage: data.usage ?? {} }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const mode: TipKind = req.body?.mode === 'personal' ? 'personal' : 'public'
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: '服务器配置错误' })
  if (!await authorizeMiniProgramProxy(req, supabaseUrl, serviceKey)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.body?.action === 'officialArticles') return respondWithOfficialArticles(res)

  const openid = typeof req.body?.openid === 'string' ? req.body.openid.trim() : ''
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const today = getShanghaiToday()

  // 仅返回基础特征（五行分布 / 主气标签），会员与否都能取（用于小贴士引导区）
  if (req.body?.action === 'tipBasics') {
    if (!openid) return res.status(200).json({ success: true, hasBasics: false })
    const { data: binding } = await supabase
      .from('user_bindings')
      .select('user_id')
      .eq('wechat_openid', openid)
      .maybeSingle()
    if (!binding?.user_id) return res.status(200).json({ success: true, hasBasics: false })

    const { data: profileRow } = await supabase
      .from('daily_tip_profiles')
      .select('elements,updated_at')
      .eq('user_id', binding.user_id)
      .maybeSingle()
    let profile = normalizeProfile(profileRow as Record<string, unknown> | null)

    if (!profile) {
      const { data: reading } = await supabase
        .from('readings')
        .select('bazi_summary,created_at')
        .eq('user_id', binding.user_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const summary = reading?.bazi_summary as Record<string, unknown> | undefined
      profile = normalizeProfile(reading ? { elements: summary?.elements, updated_at: reading.created_at } : null)
    }

    if (!profile) return res.status(200).json({ success: true, hasBasics: false })

    const meta = buildPersonalTipMeta(profile.elements, today)
    return res.status(200).json({
      success: true,
      hasBasics: true,
      basics: {
        elements: profile.elements.map((item) => ({
          element: item.element,
          label: ELEMENT_PRESENTATION[item.element as ElementName]?.label || item.element,
          percent: item.percent,
        })),
        primaryLabel: meta.primaryLabel,
        supportLabel: meta.supportLabel,
        profileSummary: meta.profileSummary,
      },
    })
  }

  const getCached = async (cacheKey: string) => {
    const { data } = await supabase.from('daily_tip_cache').select('content').eq('cache_key', cacheKey).maybeSingle()
    return data?.content as string | undefined
  }

  const saveCached = async (cacheKey: string, kind: TipKind, content: string, userId: string | null) => {
    const { error } = await supabase.from('daily_tip_cache').upsert({
      cache_key: cacheKey,
      tip_date: today.dateIso,
      tip_type: kind,
      user_id: userId,
      content,
    }, { onConflict: 'cache_key' })
    if (error) console.warn('daily tip cache write failed:', error.message)
  }

  const getPublicTip = async () => {
    return { content: buildPublicSongmianTip(today), cached: true, usage: {} }
  }

  try {
    if (mode === 'public') {
      const publicTip = await getPublicTip()
      return res.status(200).json({
        success: true,
        personalized: false,
        needsProfile: false,
        tip: publicTip.content,
        publicSummary: publicTip.content,
        personalContent: '',
        flow: null,
        cached: publicTip.cached,
        usage: publicTip.usage,
      })
    }

    if (!openid) return res.status(400).json({ error: 'Missing openid' })
    const { data: binding } = await supabase.from('user_bindings').select('user_id').eq('wechat_openid', openid).maybeSingle()
    if (!binding?.user_id) return res.status(403).json({ error: 'NOT_BOUND', message: '请先开通松眠文化账号' })

    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', binding.user_id)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()
    if (!membership) return res.status(403).json({ error: 'NOT_MEMBER', message: '需要有效会员才能阅读完整松眠小贴士' })

    const { data: profileRow } = await supabase
      .from('daily_tip_profiles')
      .select('name,gender,birth,calendar_type,elements,pillars,updated_at')
      .eq('user_id', binding.user_id)
      .maybeSingle()
    let profile = normalizeProfile(profileRow as Record<string, unknown> | null)

    if (!profile) {
      const { data: reading } = await supabase
        .from('readings')
        .select('name,input_data,bazi_summary,created_at')
        .eq('user_id', binding.user_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const input = reading?.input_data as Record<string, unknown> | undefined
      const summary = reading?.bazi_summary as Record<string, unknown> | undefined
      profile = normalizeProfile(reading ? {
        name: reading.name ?? input?.name,
        gender: input?.gender,
        birth: input?.birth,
        calendar_type: input?.calendarType,
        elements: summary?.elements,
        pillars: summary?.pillars,
        updated_at: reading.created_at,
      } : null)
    }

    if (!profile) {
      const publicTip = await getPublicTip()
      return res.status(200).json({
        success: true,
        personalized: false,
        needsProfile: true,
        tip: publicTip.content,
        publicSummary: publicTip.content,
        personalContent: '',
        flow: null,
        cached: publicTip.cached,
      })
    }

    const profileHash = crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex').slice(0, 16)
    const personalMeta = buildPersonalTipMeta(profile.elements, today)
    const cacheKey = `songmian:personal:v4:${binding.user_id}:${today.dateKey}:${profileHash}`
    const publicTipPromise = getPublicTip()
    let personalContent = await getCached(cacheKey)
    if (personalContent) {
      const sanitizedCachedContent = sanitizeDailyTip(personalContent)
      personalContent = isCompleteDailyTip(sanitizedCachedContent, 'personal')
        ? sanitizedCachedContent
        : undefined
    }
    let personalUsage: Record<string, number> = {}
    let personalCached = true

    if (!personalContent) {
      const localDraft = buildPersonalSongmianTip(profile.elements, today)
      personalContent = localDraft
      if (deepseekKey) {
        try {
          const anonymousUserId = crypto.createHash('sha256').update(binding.user_id).digest('hex').slice(0, 24)
          const generated = await polishPersonalTip(
            localDraft,
            `songmian_personal_${anonymousUserId}`,
            deepseekKey,
          )
          personalContent = generated.content
          personalUsage = generated.usage
        } catch (error) {
          console.warn('个性化松眠小贴士润色失败，返回本地完整版本:', error)
        }
      }
      personalCached = false
      personalContent = sanitizeDailyTip(personalContent)
      await saveCached(cacheKey, 'personal', personalContent, binding.user_id)
    }

    const publicTip = await publicTipPromise

    return res.status(200).json({
      success: true,
      personalized: true,
      needsProfile: false,
      tip: publicTip.content,
      publicSummary: publicTip.content,
      personalContent: sanitizeDailyTip(personalContent),
      personalMeta,
      flow: null,
      cached: publicTip.cached && personalCached,
      usage: { public: publicTip.usage, personal: personalUsage },
    })
  } catch (error) {
    console.error('miniprogram daily-tip failed:', error)
    return res.status(500).json({ error: error instanceof Error ? error.message : '松眠小贴士生成失败' })
  }
}
