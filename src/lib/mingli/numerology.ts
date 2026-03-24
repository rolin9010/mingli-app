import type { BirthDateInput, LifeNumberResult } from '../types'

const interpretations: Record<number, { title: string; interpretation: string }> = {
  1: {
    title: '主命数 1：开创者的力量',
    interpretation:
      '你更像一个“起点”。思考方式偏主动、独立，面对目标时会直接向前推进。你擅长在不确定中做决断，也容易因追求速度而显得急切。学会把行动和节奏同步，你的影响力会更持久。',
  },
  2: {
    title: '主命数 2：协同与共情',
    interpretation:
      '你擅长感知关系的细微变化。温和、敏感、重视和谐是你的优势。你可能会在关键时刻犹豫，但一旦做出选择就能用耐心与体贴把事情做扎实。建议练习边界感：在照顾他人的同时也照顾自己。',
  },
  3: {
    title: '主命数 3：表达与创造',
    interpretation:
      '你的能量来自表达。你通常有幽默感、审美与想象力，擅长把抽象的东西变得可感。你可能会分散注意力，导致阶段性热情快、持续性弱。把创意变成流程、用记录与复盘固化成果，会更稳。',
  },
  4: {
    title: '主命数 4：秩序与执行',
    interpretation:
      '你重视规则与可靠性。做事讲方法，能把复杂目标拆成可执行步骤。你可能对变化不太适应，但当环境明确时，你会展现惊人的韧性与稳定输出。建议在坚持中加入弹性：给自己留调整空间。',
  },
  5: {
    title: '主命数 5：自由与转型',
    interpretation:
      '你对新鲜感有天然吸引力，喜欢探索、旅行、跨界体验。你更适合在变化中成长，也会因为兴趣广而容易三分钟热度。建议把“自由”具体化：给自己设定可达成的短周期目标。',
  },
  6: {
    title: '主命数 6：责任与守护',
    interpretation:
      '你在关系里更重承诺。温柔、包容、擅长照顾他人是你的优势。你也可能承担过多、把压力藏起来。把爱落到行动的同时，也要允许自己被关照。你越平衡，影响力越大。',
  },
  7: {
    title: '主命数 7：洞察与深度',
    interpretation:
      '你偏向内在思考与深度理解。你可能不爱表面热闹，但对“为什么”特别敏感。你会在独处中获得灵感，也更容易在学术、研究、策略型领域发光。注意避免过度自我消耗：让表达有出口。',
  },
  8: {
    title: '主命数 8：掌控与成就',
    interpretation:
      '你对结果与资源配置有强感知。你通常有野心与行动力，擅长把机会变成成果。你可能会对自己要求很高，甚至陷入“必须赢”的压力。建议学会协作与长期主义：真正的实力来自稳定。',
  },
  9: {
    title: '主命数 9：博爱与升华',
    interpretation:
      '你更像在做“意义”的寻找。你心里有理想，也容易共情他人的处境。你可能在某些阶段表现得过于理性或敏感，需要时间消化情绪。把你的善意变成可持续的影响，你会越来越有力量。',
  },
}

function reduceTo1to9(sum: number) {
  if (sum === 0) return 9
  const r = sum % 9
  return r === 0 ? 9 : r
}

export function calcLifeNumber(birth: BirthDateInput): LifeNumberResult {
  const digits = `${birth.year}${String(birth.month).padStart(2, '0')}${String(birth.day).padStart(
    2,
    '0',
  )}`
  const sum = digits.split('').reduce((acc, ch) => acc + Number(ch), 0)
  const number = reduceTo1to9(sum)
  const base = interpretations[number]
  return {
    number,
    title: base.title,
    interpretation: base.interpretation,
  }
}

