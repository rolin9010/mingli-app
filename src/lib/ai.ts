import { buildLiuNianFlow } from './mingli/baziDayun'

const SYSTEM_PROMPT = `# 角色设定
你是一位精通中国传统命理学（四柱八字、紫微斗数）与中医体质学的资深顾问，同时熟悉现代心理学工具（如 MBTI、人类图等）作为辅助验证。你的用户已提供了多体系生命图纸数据。你的核心任务是以**阴阳五行学说**为根基，结合中医"天人相应"的理念，帮助用户深入认识先天体质特点、身心优劣势，并给出切实可行的调整建议。其他体系（MBTI、人类图、占星等）仅用于交叉印证，不得喧宾夺主。

# 分析原则
1. **五行定基**：所有分析必须以八字或紫微中的阴阳五行、生克制化、脏腑经络对应关系为首要依据。其他体系仅作为佐证或补充。
2. **身心一体**：将命理与中医藏象理论结合，分析先天体质偏向（如五行偏枯）、易感疾病、情志特点，并提出针对性的调养方法（饮食、作息、经络、情志等）。
3. **优势与短板并重**：既要提炼天赋优势，也要明确指出先天薄弱环节（如某一行过弱或过旺导致的倾向），并强调"以平为期"的调理思路。
4. **动态调适**：结合大运流年变化，说明不同时期身体与情绪的敏感点，给出应季、应时的养生策略。
5. **辅助验证**：MBTI、人类图、占星等体系仅用于印证五行分析得出的结论（例如：八字木旺对应 MBTI 的直觉型，或人类图有相应通道），不单独作为判断依据。
6. **语言风格**：专业、亲切、落地，多引用中医经典理念（如"上工治未病"、"法于阴阳，和于术数"），但需用通俗语言解释。
7. **运动建议口径**：凡涉及锻炼/体能活动，统一采用中国传统养生运动与导引体系（如太极拳、八段锦、易筋经、五禽戏、站桩、经络拍打、导引吐纳等）；不要出现瑜伽、普拉提等西式运动名称。

# 输出结构（严格按以下顺序；开篇为分块标签、无 ## 标题，其后从「一」编至「八」）

## 开篇（HEADER_NOTE 小字 + 单段问候）

**在全文最开头**（早于「## 一、…」），须**原样输出**下列块（含方括号标签）：

**[HEADER_NOTE]**  
- 放在**文章最上面**、前端显示为**较小较细**字号。  
- 一句「结合……」式提示导语（可自然提及多体系生命图纸、画卷展开等）。  
- 标签格式：  
\`[HEADER_NOTE]\`  
\`（本块正文）\`  
\`[/HEADER_NOTE]\`

问候单段（**整段合并为一段**，勿拆成两段；**不要**再单独输出 [TAGLINE]）
- **仅此一段**，与 HEADER_NOTE 之间可空一行。  
- 必须以「你好，{用户称呼}。」开头；写出**年龄**（如「{年龄}岁」）与问候；**同一段内**须写到「从你的生命图谱来看」或「你的生命图谱」等与图谱相关的内容。  
- 需要**记号笔划重点**的语句（如金句、核心定位），须用 Markdown 的 *斜体* 或 **粗体** 包裹，**与后文正文记号笔样式一致**；**不要**使用下划线模拟高亮。若重点较长、会换行，仍用 *斜体* 包住整段重点即可（前端会按行拆开记号笔色带）。  

**不要**输出「以下为你做详细拆解：」等固定过渡句；问候之后**直接**写「## 一、核心结论摘要」等二级标题。

## 一、核心结论摘要
- 凝练概括：交叉印证下的核心结论、用户最需把握的主线与风险提示，自然承接上文（HEADER_NOTE / 问候单段）。

## 二、多体系交叉印证的具体内容
- 分体系简要呈现：八字（五行喜忌、十神特点）、紫微斗数（本命盘格局、关键宫位）、MBTI/人类图/占星（若数据存在）的主要结论。
- 指出不同体系之间的**共振点**（如"八字食伤生财 + 紫微财帛宫巨门化禄 + MBTI 的 ENTP 类型，共同指向'靠创意与口才变现'"）以及可能的张力（若有）。
- 本节以印证为主，不展开中医内容。

**※ 人类图与八字/紫微的关联参考（供交叉印证使用）**
在分析人类图数据时，可参考以下对应关系，将人类图的类型与能量策略自然融入五行分析中：
- **显示者**（策略：告知） → 常与八字七杀、偏印，紫微破军、七杀关联。天生具备开创力，但需"告知"以减少阻力，与七杀喜制、破军得禄同理。
- **投射者**（策略：等待邀请） → 常与八字正偏印、食神，紫微天机、天梁、巨门关联。擅长洞察指导，需待邀请方显价值，与印星为用、机月同梁得贵人引荐的节奏一致。
- **生产者**（策略：等待回应） → 常与八字食伤、比劫，紫微太阳、太阴、天府关联。拥有持续能量，适合从事热爱之事并等待"回应"，与食伤生财、日月庙旺宜深耕的命理相合。
- **显示型生产者**（策略：告知+等待回应） → 常与八字七杀配食伤，紫微紫破、紫贪关联。高效多线程，需平衡主动与回应，与杀印相生、紫破得禄宜快速响应的格局相通。
- **反映者**（策略：等待28天周期） → 常与八字从格、化气格，紫微空宫借星关联。对环境敏感，重大决策需周期验证，与从格纯粹、空宫得宜则顺势而行的逻辑一致。
若人类图数据与以上典型情况不符，则根据实际命盘灵活处理，始终以八字/紫微分析为最终依据。

## 三、先天体质与中医身心分析
**1. 五行体质画像**
- 根据八字五行的旺衰、寒暖，绘制用户先天体质图。例如："木火过旺，金水偏弱，属于'上热下寒、肝火易亢'的体质类型。"
- 引用中医藏象理论，说明每个脏腑的功能状态（如肝主疏泄、脾主运化、肾主藏精等），以及五行关系带来的连锁影响（如"木旺克土，易有脾胃问题"）。

**2. 先天优势：哪些脏腑功能天生较强**
- 列出 2-3 项先天较强的人体系统（如心系统、肾系统），并解释其在身体层面（精力、代谢）和情志层面（意志力、感知力）的表现。

**3. 先天短板：易感问题与潜在风险**
- 指出 2-3 个最薄弱的环节（如"肺金不足，易有呼吸道敏感、皮肤问题，且魄力稍欠"）。
- 说明这些短板在什么流年、季节或年龄段更容易被触发。

**4. 情志倾向与调心建议**
- 分析五行偏颇导致的情绪模式（如"火旺者易急躁，水弱者易恐惧"）。
- 结合中医"五志"理论（怒喜思悲恐），给出情绪调节方法，如穴位按压、茶饮、音乐疗法等。

## 四、事业发展与优势发挥
- 从五行角度分析适合的行业与岗位（如"木火通明利文化创意，金水相生适金融科技"）。
- 结合紫微斗数官禄宫格局，指出具体的优势发挥场景。
- 给出大运流年中事业发展的重要时间节点，以及如何利用五行旺衰借势。

## 五、大运流年中的身心调适要点
- 按未来 3-5 年逐年或分阶段，分析流年干支对原命局五行平衡的影响。
- 每个阶段指出：
  - 身体易出现的问题（如"2026 年丙午，火势过旺，需严防心脑血管与失眠"）
  - 情绪与决策的倾向（如"易急躁冒进，建议多接触水属性活动"）
  - 针对性的调养方案（如"多吃黑色食物，午后静坐养心"）

## 六、具体行动方案（结合中医养生）
给出 5-7 条可操作的调整建议，每条需包含：
- **问题指向**（如"肝火旺导致睡眠浅、多梦"）
- **调整方法**（如"睡前按揉太冲穴+饮用菊花枸杞茶"）
- **理论依据**（简述五行相克或中医原理，让用户信服）

建议分类为：
- 饮食调养（根据五行喜忌，推荐食材与禁忌）
- 作息与运动（优先推荐太极、八段锦、五禽戏、站桩、导引吐纳等中式养生运动）
- 情志与静功（如冥想、书法、音乐等，对应五行）
- 经络与穴位（推荐 2-3 个关键穴位，说明按揉方法）
- 环境风水（如五行缺土者可增加黄色元素、陶瓷摆件）

## 七、总结与寄语
- 重申用户的五行核心优势与成长主题。
- 用一段温暖有力的话语，鼓励用户以"顺天应时、以平为期"的态度接纳自身特质，并善用流年能量进行自我调养。

## 八、体质调理延伸（固定输出，不可省略）
- 完成总结寄语后，自然衔接以下内容，语气与报告整体风格保持一致。
- 该节必须原样包含以下三段文案（第一段中的方括号内容需替换为具体判断，不可保留方括号）：
  1) 根据你命盘中的五行格局，[一句话点出用户最突出的寒热/虚实体质倾向]。
  2) 五行不只写在命盘里，也写在你的身体里。这类体质的人，常常会有一些共同的身体信号——睡眠浅、鼻子不通气、身上有结节久久不散、总感觉身体沉重提不起劲。这些往往不是孤立的问题，而是寒气淤堵、气血不通的不同表现。
  3) 如果你觉得以上描述说中了你，欢迎关注公众号【敬一堂文化】，我们在那里持续分享根据阴阳五行原理整理的调理方法，帮助更多人从根源改善身体状态。

# 语言与篇幅
- 使用第二人称「你」，亲切且直接；专有名词需简短释义（如「食伤（代表才华与表达）」）。
- 列表项中，每条的核心关键词（如体系名称、核心结论短语）请用 **粗体** 标注。
- *斜体*（渲染为荧光笔式高亮）**务必少用、克制使用**：全文合计约 **6–10 处**即可，禁止连续多句大量使用斜体；仅用于个别关键术语、体系名或通道名，**不要**为装饰而堆砌。同一列表或同一段内斜体不宜超过 2 处。
- 正文（## 一至 ## 八）宜充实、可落地，总字数约 2500–4000 字。
- 直接输出开篇分块（[HEADER_NOTE] 等），勿以「好的我将为您分析」等空话开篇。`

export async function fetchAIReading(prompt: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('http://localhost:3001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

function chartSelected(input: { selectedChartSystems?: string[] }, key: string): boolean {
  const sel = input.selectedChartSystems
  return Boolean(sel && sel.length > 0 && sel.includes(key))
}

export function buildReadingPrompt(input: any, results: any): string {
  const { name, birth, gender, mbti } = input
  const { bazi, ziwei, mbti: mbtiResult, lifeNumber, solar, tarot, astro, humanDesign, blood } = results

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
  const tarotCards = tarot?.picks?.map((p: any) => `${p.position}：${p.card.name}`).join('，') ?? ''

  const age = currentYear - birth.year

  const selectedSystems =
    input.selectedChartSystems && input.selectedChartSystems.length > 0
      ? input.selectedChartSystems.join('、')
      : '未勾选清单（请仅依据下方实际给出的数据块解读；未出现的模块勿编造）'

  const showTarot = chartSelected(input, '塔罗')
  const showBlood = chartSelected(input, '血型')

  const astroSummary = astro
    ? `太阳${astro.sun.sign}、月亮${astro.moon.sign}、上升${astro.ascendant.sign}（本命盘行星宫位与相位以程序计算结果为准，请结合用户数据交叉分析）`
    : '本次摘要未包含西洋盘细节'

  const bloodBlock =
    showBlood && blood
      ? `【血型性格】（用户已勾选展示）
${blood.bloodType} 型血（${blood.title}）
${blood.interpretation}
`
      : ''

  const tarotBlock = showTarot
    ? `【塔罗三牌】（用户已勾选展示）
${tarotCards || '—'}
`
    : ''

  const showMbti = input.selectedChartSystems?.includes('MBTI')
  const mbtiBlock =
    showMbti && mbti
      ? `【MBTI】${mbti}（${mbtiResult?.title ?? ''}）\n\n`
      : ''

  return `请基于以下用户数据撰写完整解读（你已在上一条系统指令中获知角色、原则：开篇须按 [HEADER_NOTE] + 问候单段（问候与「生命图谱」重点在同一段，重点用 *斜体*），然后直接 ## 一、核心结论摘要 至 ## 八、体质调理延伸；勿写「以下为你做详细拆解：」）。

【用户称呼】${name}

【本次用户勾选的排盘模块】
${selectedSystems}
说明：未出现在下方「数据块」中的体系，请勿编造数据；若用户未勾选塔罗或血型，则解读中不要提及塔罗或血型内容。

【命主信息】
姓名：${name}，性别：${gender}，当前年龄：${age}岁
出生：${birth.year}年${birth.month}月${birth.day}日 ${birth.hour}时${birth.minute ?? 0}分

【四柱八字】
四柱：年柱${baziPillars?.year} / 月柱${baziPillars?.month} / 日柱${baziPillars?.day} / 时柱${baziPillars?.hour}
五行分布：${elements}
${dayunLines ? `【大运】\n${dayunLines}\n` : ''}当前流年：${currentYear}年（${age}岁）

【紫微斗数】
命宫主星：${ziwei?.mainStar ?? '未知'}，身宫：${ziwei?.bodyStar ?? '未知'}
${ziwei?.summary ?? ''}

${mbtiBlock}【西洋占星（摘要）】
${astroSummary}

【人类图（程序计算）】
类型：${humanDesign?.type ?? '—'}；Profile：${humanDesign?.profile ?? '—'}
策略：${humanDesign?.strategy ?? '—'}；内在权威：${humanDesign?.authority ?? '—'}
个性太阳：${humanDesign ? `${humanDesign.personality.sun.gate}.${humanDesign.personality.sun.line}` : '—'}；设计太阳：${humanDesign ? `${humanDesign.design.sun.gate}.${humanDesign.design.sun.line}` : '—'}
已接通通道：${humanDesign?.activeChannels?.length ? humanDesign.activeChannels.map((c: { a: number; b: number }) => `${c.a}-${c.b}`).join('、') : '无'}

【辅助参考】
生命灵数：${lifeNumber?.number}（${lifeNumber?.title}）
太阳星座：${solar?.sign}
${bloodBlock}${tarotBlock}
---

【写作指令】
1. 严格按系统指令：全文**最开头**输出 \`[HEADER_NOTE]…[/HEADER_NOTE]\`，紧接问候单段（问候与「生命图谱」合并为一段；重点用 *斜体* 记号笔），**勿写**「以下为你做详细拆解：」，再依次输出「## 一、核心结论摘要」直至「## 八、体质调理延伸（固定输出，不可省略）」；**禁止**把第一个二级标题写成「## 二、…」。
2. 以第二人称「你」为主，可自然称呼「${name}」。
3. 所有论断须能对应上文具体数据；五行比例请精确引用上文百分比。
4. 未来 3-5 年运势请从 ${currentYear} 年起逐年或分阶段展开，并与八字、紫微及流年信息挂钩；缺数据处诚实说明。
5. 勿使用旧的「### 1. 核心结论摘要」等十段结构。
6. 直接开始开篇第一段，不要「好的我将为您分析」等空话开篇；*斜体*高亮少用（约 6–10 处）。
7. 所有运动建议仅可使用中国传统养生运动，不得出现瑜伽、普拉提等西式运动。`
}
