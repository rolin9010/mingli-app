import { buildLiuNianFlow } from './mingli/baziDayun'
import type { HeBanRelationType } from './types'
import { supabase } from './supabase'

/** 获取当前会话的 access token */
async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('未登录，请先登录后再使用')
  return session.access_token
}

/** 通用 API Route 调用（非流式）*/
async function callApiRoute(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const token = await getToken()
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!res.ok) {
        let msg = `服务错误 ${res.status}`
        try { msg = (JSON.parse(text) as { error?: string; message?: string }).message ?? (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* 静默 */ }
        throw new Error(msg)
      }
      const data = JSON.parse(text) as { tip?: string; content?: string }
      return (data.tip ?? data.content ?? text)
    } catch (e: unknown) {
      if (i === 2) throw e
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw new Error('重试失败')
}

/**
 * 流式调用 /api/ai/reading，返回 AsyncGenerator
 * 调用方通过 for await 逐块拿到文本
 */
export async function* fetchAIReadingStream(
  prompt: string,
  type: 'single' | 'heban' = 'single',
  mode: 'quick' | 'deep' = 'quick',
  systemPrompt?: string,
): AsyncGenerator<string> {
  const token = await getToken()
  const res = await fetch('/api/ai/reading', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, type, mode, systemPrompt }),
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = `服务错误 ${res.status}`
    try { msg = (JSON.parse(text) as { message?: string; error?: string }).message ?? (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* 静默 */ }
    throw new Error(msg)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 按行解析
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
        const chunk = parsed.choices?.[0]?.delta?.content
        if (chunk) yield chunk
      } catch { /* 忽略解析失败的行 */ }
    }
  }
}

const SYSTEM_PROMPT = `# 角色设定
你是一位精通中国传统命理学（四柱八字）与中医体质学的顾问，以阴阳五行学说为根基，帮助用户认识先天体质特点与身心优劣势，给出切实可行的调整建议。

# 分析原则
1. **五行定基**：所有分析以八字阴阳五行为首要依据，仅基于五行（金木水火土）、天干地支、阴阳生克进行解读。
2. **严格禁止**：绝对不得出现紫微斗数、命宫、星盘、西洋占星、塔罗、血型性格、MBTI、数字命理等任何其他体系的内容。
3. **身心一体**：结合中医藏象理论，分析先天体质偏向与情志特点。
4. **语言风格**：口语化、亲切、生动，像一位懂你的老朋友在娓娓道来，多用具体比喻，绝不说空话。
5. **运动建议**：仅使用中国传统养生运动（太极拳、八段锦、五禽戏、站桩、游龙拳等），不出现瑜伽、普拉提等西式运动。

# 输出结构

## 开篇

**在全文最开头**，须原样输出：

\`[HEADER_NOTE]\`
一句简短引导语，说明本文基于用户五行能量图谱生成。
\`[/HEADER_NOTE]\`

紧接一段问候（**勿添加 [GREETING] 标签**）：
- 以「你好，{用户称呼}。」开头；
- 必须写到"从你的生命能量图谱来看"或类似表达；
- 用一个生动比喻点出用户核心能量格局（如"你的格局如同一片被烈日炙烤的沃土"），关键判断用 *斜体* 标注；
- 再用 2-3 句描述旺盛五行带来的特质，以及缺失五行带来的深层隐患，让用户有"被看见"的感受。

问候段后**直接**开始「### 主题一：」，不要写过渡句。

---

## 正文：七个主题模块

格式：「### 主题N：{主题名称}」

**重要**：每个主题的副标题（"——"后面的部分）必须结合用户实际五行特质个性化生成，绝不能用通用标题。
例如火土旺缺水的人，主题一可以是"——你是一团需要'降温'的火焰"；
木旺缺金的人，可以是"——你是一棵需要'修剪'的参天大树"。

### 主题一：开篇 + 能量画像——{个性化副标题}
- 用一个贴合五行格局的生动比喻概括格局特点（哪旺哪缺），不用笼统说法。
- 旺盛五行的核心优势（2-3条，具体到行为特质，如"遇到挑战不退缩""扛事让人信赖"）。
- 缺失五行造成的隐患：**分身体和心理两个维度**分别写一句，要具体（如："身体容易上火，手脚心发热；心理上习惯绷着，放松对你来说是件难事"）。
- 用一个形象的类比点出核心矛盾（如"这就像一台动力强劲的引擎，却没有冷却液"）。
- 一句话点出"你这一生需要修的关键功课"，具体到行动方向（不是"要平衡"，而是"学会给自己降温和补水"）。

### 主题二：情绪特点——{个性化副标题}
- 先用一个生动比喻描述情绪模式（如"你的情绪，就像你体内的那团火，热烈而直接"）。
- 描述情绪失衡的具体场景：顺境时的状态 vs 逆境时的反应（要写出具体行为，如"瞬间爆发、说话直来直去"）。
- 指出深层心理根源（缺失五行如何影响安全感和内心稳定性）。
- 从中医情志角度（喜、思、忧、恐、怒）分析哪两种情绪偏旺、哪两种偏弱。
- **给出 4-5 条情绪调节方法，每条必须有一个生动小标题（格式：「XX的时候——做什么」），内容具体到动作、时间、感受，有画面感**。

方法的写作格式必须参照以下示例（根据用户的五行特质改写，不得照抄）：

> **急的时候——先停三个数**：感到火气往上冲、想发火或想立刻做决定时，心里默数"一、二、三"，同时做一个深长的呼吸，把气呼干净，然后再开口或行动。这三秒钟是你给自己的"冷却时间"。
>
> **烦的时候——把手放在肚子上**：焦虑、心慌的时候，把一只手轻轻放在小腹（肚脐以下），慢慢呼吸，把注意力放在手和肚子接触的感觉上。这个小动作能让上面乱转的气往下沉，做两分钟就有效果。
>
> **静不下来的时候——找一件"磨性子"的事**：每天固定15分钟，做一件完全不追求效率的事：临摹一篇字帖、用毛笔抄几句诗、听一首古琴曲什么都别干。不是为了出作品，就是为了让自己慢下来。
>
> **长期来说——练一门"沉气"的功夫**：站桩、八段锦、游龙拳，这些传统功法最大的好处不是锻炼身体，而是把浮在上面的火气引下来。每天坚持十几分钟，慢慢你会发现，以前一点就着的事，现在能缓一缓了。
>
> **实在放松不下来的时候**：如果你试了上面这些方法还是静不下来，不是你不行，是你的燥火太强了。放松本身是一门需要学习和练习的能力，尤其对你这种体质的人。如果需要，可以联系【敬一堂文化】，我们有针对你这种体质的传统放松方法指导。

注意：
  - 每条必须先有**加粗标题**，再是具体内容，标题和内容之间用冒号隔开
  - 即时可做的方法（当下缓解）至少写 2 条
  - 长期修习的方法至少写 1 条
  - 最后一条必须是引导【敬一堂文化】，语气温和，像朋友说话，不像广告

### 主题三：人际关系——{个性化副标题}
分三个场景，每个场景单独成段，前后空行：

**1. 在职场中——{个性化小标题}**
核心优势（1条）+ 最容易产生摩擦的具体场景（1条）+ 具体改善方向（1-2条，给出可操作的话术或行动）。

**2. 在亲情和友情中——{个性化小标题}**
你对亲近人的方式（1条）+ 可能造成的距离感（具体描述，不要泛泛而谈）+ 1条具体改善方向（如"偶尔不带任何目的地，只是安静地陪朋友喝杯茶"）。

**3. 在婚恋感情中（请根据你的现状对号入座）**
- **如果你目前单身**：你的吸引力特点 + 相处久了可能出现的问题（具体描述）+ 1条建议（指向"展现脆弱和柔软"的方向）
- **如果你目前已有伴侣（恋爱中或已婚）**：你表达爱的方式 + 伴侣可能的感受（如"很好，但不够亲近"）+ 1-2条具体改善方向（要新颖，如"静默陪伴"）

### 主题四：事业方向——{个性化副标题}
**你天然适合的领域**（列 4-5 条，每条一句具体理由，避免套话）。

**让你身心平衡的传统爱好**（1-2 条，对应缺失五行的调养）。

**需要谨慎的领域**（列 3-4 条，每条说明原因，要直接点明"会让你如何"）。

**任何让你持续紧绷、忽略休息的工作模式**，结尾加一句点睛（如"对你而言，休息不是软弱，是必要的'冷却'"）。

### 主题五：子女相关——{个性化副标题}
- 先从五行角度点出你在亲子关系中的核心模式（1句，要具体，如"你的爱会很'满'，但容易因标准高、节奏快，让孩子感到压力"）。
- **如果你已有子女**：给出1条具体建议，要有画面感（如"可以有意识地在孩子面前'慢下来'……让孩子感受到：爸爸/妈妈在陪我的时候，是真正在的"）。
- **如果你未来有生育计划**：结合体质特点给出调养建议（具体提到身体层面和习惯养成）。

### 主题六：身体养护——{个性化副标题}
- 先点出最典型的 1-2 个身体信号，要具体（如"手心脚心发热、容易口腔溃疡、睡眠浅或易惊醒"）。
- **饮食上**：推荐 4-5 种食物，每种一句对应的功效理由；需要避免的食物类型（用比喻说明危害，如"无异于火上浇油"）。
- **作息上**：1-2条具体习惯，要指出时间点和理由（如"务必在晚上11点前睡觉……等于放弃了最重要的一次'补水'机会"）。
- **功法与穴位**：推荐 1-2 个具体功法动作（说明功效）+ 1-2 个穴位（写出位置、按揉方法和对应症状）。

### 主题七：未来行动指南——{个性化副标题}
- 当前大运阶段的能量特点（1-2 句，要有画面感）。
- 未来 3-5 年逐年展开，每年格式如下：
  「**{年份}{干支年}**：{8字以内的核心总结}。{2-4句具体描述，包含该年能量特点、机遇或风险、最重要的1条核心策略，策略要加粗或用"核心策略是'XX'"句式点出}」
- **每天可落地的3个小行动**（每条有标题，内容具体、有画面感、与五行对应）。
- 末尾用一段温暖寄语收束全文：把用户的五行特质升华为正面意象（有头有尾，像诗一样），最后自然衔接【敬一堂文化】（语气温和，像是老友的一句话，不是广告）。

---

# 写作要求
- 全文使用第二人称「你」，可自然称呼用户姓名。
- **语言口语化、生动**，多用比喻，读者不懂命理也能共鸣，绝不写"你的五行格局…"这样的废话开头。
- *斜体* 高亮全文 6-10 处最关键判断，不滥用。
- **每个主题 300-500 字**，整篇总字数控制在 3000-4500 字。
- 五行数据精确引用百分比，不能用"偏旺""较强"等模糊词代替具体数字。
- 直接以 [HEADER_NOTE] 开始，不要以"好的，我将为您分析"等空话开头。
- 未来年份运势必须与八字流年干支挂钩，标题格式如「2026丙午年」。
- **各主题副标题（"——"后的部分）必须个性化**，不得用通用句式，必须反映该用户的真实五行特质。`

/**
 * 非流式调用（兼容旧调用方，内部把流式内容拼接后返回）
 * 注意：此函数仍需登录，且会扣积分
 */
export async function fetchAIReading(prompt: string, mode: 'quick' | 'deep' = 'quick'): Promise<string> {
  let result = ''
  for await (const chunk of fetchAIReadingStream(prompt, 'single', mode, SYSTEM_PROMPT)) {
    result += chunk
  }
  return result
}

// ── 合盘 System Prompt ──────────────────────────────────────────────────────────

const HEBAN_SYSTEM_PROMPT = `# 角色设定
你是一位精通中国传统命理学（四柱八字）的合盘解读大师，以阴阳五行学说为根基，帮助用户了解两人之间的能量关系、契合度与互补之道。

# 分析原则
1. **五行为纲**：所有分析以双方八字五行为首要依据，仅基于五行（金木水火土）、天干地支、阴阳生克进行解读。
2. **严格禁止**：绝对不得出现紫微斗数、命宫、星盘、西洋占星、塔罗、血型性格、MBTI、数字命理等任何其他体系的内容。
3. **关系导向**：根据两人的关系类型调整解读重点与语言风格。
4. **语言风格**：亲切、落地，像朋友娓娓道来，用通俗比喻帮助理解。
5. **客观平衡**：既讲契合优势，也坦诚指出可能的挑战，给出具体化解方向。

# 输出结构

## 开篇

**在全文最开头**，须原样输出：

\`[HEADER_NOTE]\`
一句简短引导语，说明本文基于两人五行能量合盘分析生成。
\`[/HEADER_NOTE]\`

紧接一段问候（**勿添加 [GREETING] 标签**）：
- 以「你好。」开头，简述两人关系与合盘主旨；
- 用 1-2 句话点出最核心的能量契合特质，关键判断用 *斜体* 标注。

问候段后**直接**开始「### 主题一：」，不要写过渡句。

---

## 正文：五个主题模块（每个主题 200-350 字）

格式：「### 主题N：{主题名称}」

### 主题一：能量契合——{生动小标题}
- 用一个比喻概括双方五行格局关系（相生、相克、互补、同质）。
- 两人五行的核心契合点（2-3 条）。
- 可能的能量摩擦点（1-2 条）。
- 一句话"两人合盘核心课题"结尾。

### 主题二：关系互动——{小标题}（根据关系类型调整标题）
**情感模式**：描述两人相处时的情感互动特点。
**沟通风格**：两人表达方式的差异与融合点。
**典型挑战**：最容易产生摩擦的场景 + 1 条具体化解方向。

### 主题三：协作与互补
**各自优势**：甲方与乙方分别带来的五行能量优势。
**最佳配合点**：两人能量最互补、最能共同发挥的领域（3-4 条，每条一句理由）。
**需要小心的盲区**（2-3 条，每条一句理由）。

### 主题四：共同成长方向
- 当前大运阶段对两人关系的影响（1-2 句）。
- 未来 2-3 年两人关系的关键节奏（每年或每阶段 1 句核心提示）。
- 3 条两人可共同落地的小行动（具体、可执行）。

### 主题五：相处建议
- 最典型的 1-2 个关系信号（具体场景），单独成段。
- **对 {甲方姓名} 的建议**（单独成段，另起一行，列 2 条，每条各占一行）。
- **对 {乙方姓名} 的建议**（单独成段，另起一行，列 2 条，每条各占一行）。
- 一段温暖寄语（把两人五行特质升华为正面意象），单独成段。

---

# 写作要求
- 全文使用第二人称，自然称呼双方姓名。
- **语言生动易懂**，多用比喻，读者不懂命理也能共鸣。
- *斜体* 高亮全文 4-6 处最关键判断，不滥用。
- **每个主题 200-350 字**，整篇总字数控制在 1500-2200 字。
- 五行数据精确引用百分比。
- 直接以 [HEADER_NOTE] 开始，不要以"好的，我将为您分析"等空话开头。
- **全文只能基于五行体系**，禁止提及紫微斗数、命宫、主星、星盘、占星、血型、MBTI 等任何非五行内容。
- **排版强制要求**：每当涉及"对甲方/对乙方"、"第一/第二/第三"、"甲方优势/乙方优势"等分人或分项内容时，必须各自单独成段，用空行隔开，禁止融入同一段落中。`

export function buildHeBanPrompt(
  inputA: any,
  resultsA: any,
  inputB: any,
  resultsB: any,
  relation: HeBanRelationType,
  mode: 'quick' | 'deep' = 'quick',
): string {
  const currentYear = new Date().getFullYear()

  const baziPillarsA = resultsA?.bazi?.pillars
  const elementsA = resultsA?.bazi?.elements?.map((e: any) => `${e.element}占${Number(e.percent).toFixed(1)}%`).join('、') ?? ''
  const dayunA = resultsA?.bazi?.dayun
  const dayunLinesA = dayunA?.rows?.length && dayunA.qiYunText
    ? [
        `起运：${dayunA.qiYunText}`,
        ...dayunA.rows.slice(0, 4).map(
          (r: any) => `第${r.step}大运 ${r.ganZhi}（${r.startYear}–${r.endYear}年）`,
        ),
      ].join('；')
    : ''

  const baziPillarsB = resultsB?.bazi?.pillars
  const elementsB = resultsB?.bazi?.elements?.map((e: any) => `${e.element}占${Number(e.percent).toFixed(1)}%`).join('、') ?? ''
  const dayunB = resultsB?.bazi?.dayun
  const dayunLinesB = dayunB?.rows?.length && dayunB.qiYunText
    ? [
        `起运：${dayunB.qiYunText}`,
        ...dayunB.rows.slice(0, 4).map(
          (r: any) => `第${r.step}大运 ${r.ganZhi}（${r.startYear}–${r.endYear}年）`,
        ),
      ].join('；')
    : ''

  const ageA = currentYear - inputA.birth.year
  const ageB = currentYear - inputB.birth.year

  const relationLabel: Record<HeBanRelationType, string> = {
    '情侣': '情侣关系',
    '夫妻': '夫妻关系',
    '亲子': '亲子关系（父母与子女）',
    '朋友': '朋友关系',
    '事业合伙': '事业合伙关系',
  }

  const usersData = `【关系类型】${relationLabel[relation]}

【甲方信息】
姓名：${inputA.name}，性别：${inputA.gender}，当前年龄：${ageA}岁
出生：${inputA.birth.year}年${inputA.birth.month}月${inputA.birth.day}日 ${inputA.birth.hour}时${inputA.birth.minute ?? 0}分
四柱：年柱${baziPillarsA?.year} / 月柱${baziPillarsA?.month} / 日柱${baziPillarsA?.day} / 时柱${baziPillarsA?.hour}
五行分布：${elementsA}
${dayunLinesA ? `大运：${dayunLinesA}` : ''}

【乙方信息】
姓名：${inputB.name}，性别：${inputB.gender}，当前年龄：${ageB}岁
出生：${inputB.birth.year}年${inputB.birth.month}月${inputB.birth.day}日 ${inputB.birth.hour}时${inputB.birth.minute ?? 0}分
四柱：年柱${baziPillarsB?.year} / 月柱${baziPillarsB?.month} / 日柱${baziPillarsB?.day} / 时柱${baziPillarsB?.hour}
五行分布：${elementsB}
${dayunLinesB ? `大运：${dayunLinesB}` : ''}

当前流年：${currentYear}年`

  if (mode === 'quick') {
    return `请基于以下双方数据，撰写一篇流畅连贯的五行合盘解读短文。

${usersData}

---

【写作指令】
1. 先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接一段亲切的问候（点出两人最核心的能量契合特质，关键判断用 *斜体*）。
2. 问候段后直接写正文。**全文不分章节、不加任何标题**，用自然流畅的段落依次覆盖：两人五行能量契合度与核心共鸣点、相处中最容易出现的摩擦与化解方向、各自能互补对方的地方、近期两人关系的节奏提示。
3. 语言亲切温暖、口语化，像一位了解双方的朋友在聊天，多用比喻，不懂命理的人也能共鸣。
4. 全文总字数控制在 **600-1000 字**，重点突出最关键的 2-3 个洞见，不铺展细节。
5. 五行比例精确引用上文百分比数据，自然称呼「${inputA.name}」和「${inputB.name}」。
6. 直接以 [HEADER_NOTE] 开始，不要"好的，我将为您分析"等空话；*斜体* 高亮全文 3-5 处最关键判断。
7. **全文只能基于五行体系**，禁止提及紫微斗数、命宫、星盘、占星、血型、MBTI 等任何非五行内容。`
  }

  return `请基于以下双方数据，严格按系统指令的"五个主题模块"结构撰写深度完整合盘解读。

${usersData}

---

【写作指令】
1. 开篇：先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接问候单段（重点用 *斜体*）。
2. 正文严格按五个主题输出（每个主题必须使用三级标题 ### 主题N）：
   「### 主题一：能量契合」→「### 主题二：关系互动」→「### 主题三：协作与互补」→「### 主题四：共同成长方向」→「### 主题五：相处建议」。
3. 关系类型为「${relation}」，主题二的标题与侧重请根据此关系类型调整。
4. 以第二人称为主，自然称呼「${inputA.name}」和「${inputB.name}」；五行比例精确引用上文百分比数据。
5. 直接以 [HEADER_NOTE] 开始，不要"好的，我将为您分析"等空话；*斜体*高亮全文约 6–10 处。
6. **排版强制要求**：凡涉及"对${inputA.name}的建议""对${inputB.name}的建议""甲方优势""乙方优势""第一/第二/第三"等分人或分项内容，必须各自**单独成段**（前后用空行隔开），禁止融入同一段落。
7. 主题一能量契合：增加两人五行生克的详细分析（哪行生哪行、哪行克哪行），并结合实际场景举例。
8. 主题二关系互动：增加 2-3 个具体互动场景描述（用"当……时，……会……"的句式展开）。
9. 主题三协作互补：最佳配合点扩展至 5-6 条，并给出具体的合作领域或项目建议。
10. 主题四共同成长：未来逐年分析延伸至 3-5 年，每年给出"最佳行动"和"需要警惕"两个要点。
11. 主题五相处建议：对双方建议各扩展至 3-4 条，每条给出具体话术或行动示例；末尾附温暖寄语。
12. **每个主题 400-600 字**，整篇总字数控制在 3000-4500 字，整体增加更多温情共鸣感，让两人都有"被深度理解"的感受。
13. **全文只能基于五行体系**，禁止提及紫微斗数、命宫、主星、星盘、占星、血型、MBTI 等任何非五行内容。`
}

export async function fetchHeBanAIReading(prompt: string, mode: 'quick' | 'deep' = 'quick'): Promise<string> {
  let result = ''
  for await (const chunk of fetchAIReadingStream(prompt, 'heban', mode, HEBAN_SYSTEM_PROMPT)) {
    result += chunk
  }
  return result
}

// ── 五行每日贴士 ─────────────────────────────────────────────────────────────
// System Prompt 已移至服务端 /api/ai/daily-tip.ts，前端不再需要

export function buildDailyTipPrompt(input: any, results: any, dateStr: string): string {
  const { name, birth, gender } = input
  const { bazi } = results
  const elements =
    bazi?.elements?.map((e: any) => `${e.element}占${Number(e.percent).toFixed(1)}%`).join('、') ?? ''
  const pillars = bazi?.pillars
  const age = new Date().getFullYear() - birth.year

  return `【用户信息】
姓名：${name}，性别：${gender}，年龄：${age}岁
五行分布：${elements}
四柱：年柱${pillars?.year} / 月柱${pillars?.month} / 日柱${pillars?.day} / 时柱${pillars?.hour}

【今日日期】${dateStr}

请基于以上信息，为${name}生成今天的五行养生贴士（60-120字，口语化，末尾一个Emoji）。`
}

/** 每日贴士：通过服务端 /api/ai/daily-tip 调用，需要会员 */
export async function fetchDailyTip(prompt: string): Promise<string> {
  return callApiRoute('/api/ai/daily-tip', { prompt })
}

export function buildReadingPrompt(input: any, results: any, mode: 'quick' | 'deep' = 'quick'): string {
  const { name, birth, gender } = input
  const { bazi } = results

  const baziPillars = bazi?.pillars
  const dayun = bazi?.dayun
  const currentYear = new Date().getFullYear()
  const liuNianPrompt =
    birth?.year != null
      ? buildLiuNianFlow(birth.year, currentYear, 5, 5)
          .map((x) => `${x.year}年${x.ganZhi}（${x.age}岁）`)
          .join('；')
      : ''
  const dayunLines =
    dayun?.rows?.length && dayun.qiYunText
      ? [
          `大运顺逆：${dayun.isForward ? '顺排' : '逆排'}（阳男阴女顺、阴男阳女逆）`,
          `起运：${dayun.qiYunText}`,
          ...(dayun.tong
            ? [
                `童限（小运）：${dayun.tong.startYear}–${dayun.tong.endYear}年，虚岁${dayun.tong.startAge}–${dayun.tong.endAge}岁`,
              ]
            : []),
          ...dayun.rows.map(
            (r: {
              step: number
              ganZhi: string
              startYear: number
              endYear: number
              startAge: number
              endAge: number
            }) =>
              `第${r.step}大运 ${r.ganZhi}（${r.startYear}–${r.endYear}年，虚岁${r.startAge}–${r.endAge}岁）`,
          ),
          ...(liuNianPrompt ? [`近年流年（立春换年）：${liuNianPrompt}`] : []),
        ].join('\n')
      : ''
  const elements =
    bazi?.elements?.map((e: any) => `${e.element}占${Number(e.percent).toFixed(1)}%`).join('、') ?? ''

  const age = currentYear - birth.year

  const userData = `【用户称呼】${name}

【命主信息】
姓名：${name}，性别：${gender}，当前年龄：${age}岁
出生：${birth.year}年${birth.month}月${birth.day}日 ${birth.hour}时${birth.minute ?? 0}分

【四柱八字】
四柱：年柱${baziPillars?.year} / 月柱${baziPillars?.month} / 日柱${baziPillars?.day} / 时柱${baziPillars?.hour}
五行分布：${elements}
${dayunLines ? `【大运】\n${dayunLines}\n` : ''}当前流年：${currentYear}年（${age}岁）`

  if (mode === 'quick') {
    return `请基于以下用户数据，撰写一篇流畅连贯的五行能量解读短文。

${userData}

---

【写作指令】
1. 先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接一段亲切的问候（必须包含「从你的生命能量图谱来看」或类似表达；关键判断用 *斜体*）。
2. 问候段后直接写正文。**全文不分章节、不加任何标题**，用自然流畅的段落依次覆盖：能量格局与核心特质、情绪模式与调节建议、人际相处之道、事业与健康提示、近1-2年运势方向。
3. 语言口语化、生动有温度，像朋友聊天一样娓娓道来，多用比喻，读者不懂命理也能共鸣。
4. 全文总字数控制在 **800-1200 字**，重点突出最关键的 2-3 个洞见，不铺展细节。
5. 五行比例精确引用上文百分比数据，以第二人称「你」为主，可自然称呼「${name}」。
6. 直接以 [HEADER_NOTE] 开始，不要「好的，我将为您分析」等空话；*斜体* 高亮全文 3-5 处最关键判断。
7. 所有运动建议仅使用中国传统养生运动，**全文只能基于五行体系**，禁止提及紫微斗数、命宫、星盘、占星、血型、MBTI 等任何非五行内容。`
  }

  return `请基于以下用户数据，严格按系统指令的"七个主题模块"结构撰写深度完整解读。

${userData}

---

【写作指令】
1. 开篇：先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接问候单段（必须包含「从你的生命能量图谱来看」或类似表达；重点用 *斜体*）。
2. 正文严格按七个主题输出（每个主题必须使用三级标题 ### 主题N）：
   「### 主题一：开篇 + 能量画像——你是一个什么样的人」
   →「### 主题二：情绪特点——为什么总是绷着，以及怎么办」
   →「### 主题三：人际关系——你和身边人的相处之道」
   →「### 主题四：事业方向——你适合做什么，不适合做什么」
   →「### 主题五：子女相关——你的亲子关系与养育提示」
   →「### 主题六：身体养护——日常怎么吃怎么睡怎么调」
   →「### 主题七：未来行动指南——未来3-5年的详细节奏」
3. **禁止**输出「## 一、…」「## 二、…」等旧版编号章节；必须用三级标题 ### 主题N。
4. 以第二人称「你」为主，可自然称呼「${name}」；五行比例精确引用上文百分比数据。
5. 主题七的未来运势从 ${currentYear} 年起逐年展开至 5-7 年，每年标题格式如「${currentYear}丙午年：{八字概括}」，每年分析包含"核心机遇"和"最大风险"两个维度。
6. 主题三的人际关系需分「工作中」「亲情友情」「婚恋感情」三个场景，每场景 2-3 条改善方向并给出具体话术示例。
7. 主题五的子女部分需覆盖「已有子女」和「未来有生育计划」两种情况。
8. 主题六的身体养护推荐 6-8 种食物，需包含饮食、作息、情志调养、穴位按揉（3-4 个穴位）四个维度。
9. 主题二情绪调节方法扩展至 6-7 条，增加更多具体场景案例。
10. 主题四事业方向增加 2-3 个具体行业案例分析（结合五行阐述为何适合/不适合），每天可落地行动扩展至 5 条。
11. 直接以 [HEADER_NOTE] 开始，不要「好的，我将为您分析」等空话；*斜体*高亮全文约 6–10 处。
12. **每个主题 500-800 字**，整篇总字数控制在 5000-7000 字，整体增加更多生动比喻和真实场景描述，让用户有强烈的"被深度看见"感。
13. 所有运动建议仅使用中国传统养生运动，不得出现瑜伽、普拉提等西式运动。
14. **全文只能基于五行体系**，禁止提及紫微斗数、命宫、主星、星盘、占星、血型、MBTI 等任何非五行内容。`
}
