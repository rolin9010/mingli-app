import { buildLiuNianFlow } from './mingli/baziDayun'
import type { HeBanRelationType } from './types'

const SYSTEM_PROMPT = `# 角色设定
你是一位精通中国传统命理学（四柱八字）与中医体质学的顾问，以阴阳五行学说为根基，帮助用户认识先天体质特点与身心优劣势，给出切实可行的调整建议。

# 分析原则
1. **五行定基**：所有分析以八字阴阳五行为首要依据。
2. **身心一体**：结合中医藏象理论，分析先天体质偏向与情志特点。
3. **语言风格**：亲切、落地，像朋友娓娓道来，用通俗比喻帮助理解。
4. **运动建议**：仅使用中国传统养生运动（太极拳、八段锦、五禽戏、站桩等），不出现瑜伽、普拉提等西式运动。

# 输出结构

## 开篇

**在全文最开头**，须原样输出：

\`[HEADER_NOTE]\`
一句简短引导语，说明本文基于用户五行能量图谱生成。
\`[/HEADER_NOTE]\`

紧接一段问候（**勿添加 [GREETING] 标签**）：
- 以「你好，{用户称呼}。」开头；
- 写到"从你的五行能量图谱来看"或类似表达；
- 用 1-2 句话点出最核心的能量特质，关键判断用 *斜体* 标注。

问候段后**直接**开始「### 主题一：」，不要写过渡句。

---

## 正文：五个主题模块（每个主题 200-350 字，精炼为上）

格式：「### 主题N：{主题名称}」

### 主题一：你的能量画像——{生动小标题}
- 用一个比喻概括五行格局（哪旺哪缺）。
- 旺盛五行的核心优势（2-3条）。
- 缺失五行的主要隐患（1-2条，身心各一）。
- 一句话"人生核心课题"结尾。
- 末尾自然引导【敬一堂文化】一句。

### 主题二：情绪与关系——{小标题}
**情绪模式**：描述情绪失衡的具体场景（不只说"易焦虑"），给 1 条可操作调节方向。

**职场**：核心优势 + 最容易产生摩擦的场景 + 1 条具体调整方法。

**亲密关系**：表达爱的方式 + 可能造成的距离感 + 1 条具体改善方向。

### 主题三：事业方向
**适合的领域**（列 4-5 条，每条一句理由）。

**需谨慎的领域**（列 3-4 条，每条一句理由）。

### 主题四：突破与行动
- 当前大运阶段能量特点（1-2 句）。
- 未来 2-3 年关键节奏（每年或每阶段 1 句核心提示）。
- 3 条每天可落地的小行动（具体、可执行）。
- 末尾自然引导【敬一堂文化】一句。

### 主题五：身体养护
- 最典型的 1-2 个身体信号（具体症状）。
- 推荐食物 3-4 种（各一句五行理由）；需避免食物 2 种。
- 1 条作息习惯。
- 一段温暖寄语（把五行特质升华为正面意象），自然衔接【敬一堂文化】。

---

# 写作要求
- 全文使用第二人称「你」，可称呼用户姓名。
- **语言生动易懂**，多用比喻，读者不懂命理也能共鸣。
- *斜体* 高亮全文 4-6 处最关键判断，不滥用。
- **每个主题 200-350 字**，整篇总字数控制在 1500-2200 字。
- 五行数据精确引用百分比。
- 直接以 [HEADER_NOTE] 开始，不要以"好的，我将为您分析"等空话开头。`

export async function fetchAIReading(prompt: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 6000,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`AI API 错误: ${res.status} ${text}`)
      const data = JSON.parse(text)
      return data.choices[0].message.content as string
    } catch (e: any) {
      if (i === 2) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error('重试失败')
}

// ── 合盘 System Prompt ──────────────────────────────────────────────────────────

const HEBAN_SYSTEM_PROMPT = `# 角色设定
你是一位精通中国传统命理学（四柱八字）的合盘解读大师，以阴阳五行学说为根基，帮助用户了解两人之间的能量关系、契合度与互补之道。

# 分析原则
1. **五行为纲**：所有分析以双方八字五行为首要依据，关注生克、合冲、互补关系。
2. **关系导向**：根据两人的关系类型调整解读重点与语言风格。
3. **语言风格**：亲切、落地，像朋友娓娓道来，用通俗比喻帮助理解。
4. **客观平衡**：既讲契合优势，也坦诚指出可能的挑战，给出具体化解方向。

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
- 最典型的 1-2 个关系信号（具体场景）。
- 对甲方的 2 条建议；对乙方的 2 条建议。
- 一段温暖寄语（把两人五行特质升华为正面意象）。

---

# 写作要求
- 全文使用第二人称，自然称呼双方姓名。
- **语言生动易懂**，多用比喻，读者不懂命理也能共鸣。
- *斜体* 高亮全文 4-6 处最关键判断，不滥用。
- **每个主题 200-350 字**，整篇总字数控制在 1500-2200 字。
- 五行数据精确引用百分比。
- 直接以 [HEADER_NOTE] 开始，不要以"好的，我将为您分析"等空话开头。`

export function buildHeBanPrompt(
  inputA: any,
  resultsA: any,
  inputB: any,
  resultsB: any,
  relation: HeBanRelationType,
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

  return `请基于以下双方数据，严格按系统指令的"五个主题模块"结构撰写完整合盘解读。

【关系类型】${relationLabel[relation]}

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

当前流年：${currentYear}年

---

【写作指令】
1. 开篇：先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接问候单段（重点用 *斜体*）。
2. 正文严格按五个主题输出：「### 主题一：能量契合」→「### 主题二：关系互动」→「### 主题三：协作与互补」→「### 主题四：共同成长方向」→「### 主题五：相处建议」。
3. 关系类型为「${relation}」，主题二的标题与侧重请根据此关系类型调整。
4. 以第二人称为主，自然称呼「${inputA.name}」和「${inputB.name}」；五行比例精确引用上文百分比数据。
5. 直接以 [HEADER_NOTE] 开始，不要"好的，我将为您分析"等空话；*斜体*高亮全文约 6–10 处。`
}

export async function fetchHeBanAIReading(prompt: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: HEBAN_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.85,
          max_tokens: 6000,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`AI API 错误: ${res.status} ${text}`)
      const data = JSON.parse(text)
      return data.choices[0].message.content as string
    } catch (e: any) {
      if (i === 2) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error('重试失败')
}

export function buildReadingPrompt(input: any, results: any): string {
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

  return `请基于以下用户数据，严格按系统指令的"五个主题模块"结构撰写完整解读。

【用户称呼】${name}

【命主信息】
姓名：${name}，性别：${gender}，当前年龄：${age}岁
出生：${birth.year}年${birth.month}月${birth.day}日 ${birth.hour}时${birth.minute ?? 0}分

【四柱八字】
四柱：年柱${baziPillars?.year} / 月柱${baziPillars?.month} / 日柱${baziPillars?.day} / 时柱${baziPillars?.hour}
五行分布：${elements}
${dayunLines ? `【大运】\n${dayunLines}\n` : ''}当前流年：${currentYear}年（${age}岁）

---

【写作指令】
1. 开篇：先输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接问候单段（必须包含「从你的五行能量图谱来看」或类似表达；重点用 *斜体*）。
2. 正文严格按五个主题输出：「### 主题一：你的能量画像」→「### 主题二：情绪与关系」→「### 主题三：事业方向」→「### 主题四：突破与行动」→「### 主题五：身体养护」。
3. **禁止**输出「## 一、…」「## 二、…」等旧版编号章节；必须用三级标题 ### 主题N。
4. 以第二人称「你」为主，可自然称呼「${name}」；五行比例精确引用上文百分比数据。
5. 未来 3-5 年运势从 ${currentYear} 年起展开，与八字及流年信息挂钩。
6. 直接以 [HEADER_NOTE] 开始，不要「好的，我将为您分析」等空话；*斜体*高亮全文约 6–10 处。
7. 所有运动建议仅使用中国传统养生运动，不得出现瑜伽、普拉提等西式运动。`
}
