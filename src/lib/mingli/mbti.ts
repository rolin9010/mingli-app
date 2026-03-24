import type { MBTI, MbtiResult } from '../types'

const mapping: Record<MBTI, { title: string; interpretation: string }> = {
  INTJ: {
    title: 'INTJ：战略型理性规划师',
    interpretation:
      '你擅长结构化思考，目标清晰时执行力很强。你可能显得冷静克制，但内心对“意义与逻辑”很执着。建议：在高标准之外，也给关系与沟通留出弹性，让团队更顺畅。',
  },
  INFJ: {
    title: 'INFJ：洞察型理想主义者',
    interpretation:
      '你重视精神价值与长期方向，洞察力强，容易感知他人真正的需求。你也可能沉浸在自己的世界里。建议：把理解转化为表达，用温和的方式带动改变。',
  },
  ISTJ: {
    title: 'ISTJ：稳健型责任实践者',
    interpretation:
      '你做事讲原则、重纪律，擅长把事情落实到细节。你可能不太爱改变，但稳定就是你的优势。提醒：允许小范围试错，你会更快找到最适合自己的道路。',
  },
  ISFJ: {
    title: 'ISFJ：照顾型守护者',
    interpretation:
      '你关心他人感受，善于维护关系的安全感。你可能把自己的需求放在后面。建议：学会清晰表达边界，用更轻松的方式分担与请求支持。',
  },
  INFP: {
    title: 'INFP：价值驱动型内在诗人',
    interpretation:
      '你对真诚与意义非常敏感，情绪与直觉很有力量。你可能会在现实与理想之间拉扯。建议：为理想设定阶段性目标，让热情落地为行动。',
  },
  INTP: {
    title: 'INTP：探索型逻辑思考家',
    interpretation:
      '你喜欢理解机制与本质，思维敏捷，擅长拆解复杂问题。你可能显得不那么在意外界节奏。提醒：适当提升“落地频率”，别只停留在想法。',
  },
  ENTJ: {
    title: 'ENTJ：领导型高效架构师',
    interpretation:
      '你对效率与结果敏感，擅长统筹与推进。你可能在表达上偏直接。建议：多一点同理心的反馈，你会带出更强的团队凝聚力。',
  },
  ENFJ: {
    title: 'ENFJ：共情型带领者',
    interpretation:
      '你很会读懂人心，擅长激励与组织。你也容易把别人期待扛在自己身上。建议：让关系更“互相”，而不是“你一个人的付出”。',
  },
  ENTP: {
    title: 'ENTP：点子型辩论探索者',
    interpretation:
      '你脑回路快，喜欢挑战假设，擅长提出新方案。你可能对细节缺乏耐心。建议：为兴趣设一个完成标准，你的点子会更有成果。',
  },
  ENFP: {
    title: 'ENFP：灵感型热情传播者',
    interpretation:
      '你精力充沛、想象力强，擅长把气氛带动起来。你可能在后期推进上力有不逮。建议：把愿景拆成步骤，保持持续输出。',
  },
  ISTP: {
    title: 'ISTP：现场型行动解决者',
    interpretation:
      '你更喜欢在真实环境中观察与处理问题。你思考务实，反应快。提醒：别只追求当下的爽感，把长期规划也纳入你的节奏。',
  },
  ISFP: {
    title: 'ISFP：审美型温柔行动派',
    interpretation:
      '你重视个人体验与感受，善于欣赏细节，也更愿意用行动表达善意。建议：在选择上更果断一点，让生活更贴近你想要的方向。',
  },
  ESTP: {
    title: 'ESTP：实战型灵活破局者',
    interpretation:
      '你擅长应变与快速决策，喜欢用行动验证观点。你可能对规则束缚较敏感。提醒：在冲劲之外建立边界，你会更安全也更持久。',
  },
  ESFP: {
    title: 'ESFP：舞台型社交感染者',
    interpretation:
      '你有感染力，擅长让气氛变好。你可能会在选择时受外界影响。建议：回到自己的价值清单，给热情一个稳定的方向。',
  },
  ESTJ: {
    title: 'ESTJ：秩序型管理执行者',
    interpretation:
      '你重视组织与效率，擅长把资源安排得更有条理。你可能偏强势。建议：更多倾听与解释，你的领导会更容易被接受。',
  },
  ESFJ: {
    title: 'ESFJ：关系型温暖协调员',
    interpretation:
      '你很会照顾团队氛围，能把细节照顾到位。你可能在意他人评价。建议：把自我价值建立在行动和成长上，减少自责。',
  },
}

export function calcMbti(mbti: MBTI): MbtiResult {
  const base = mapping[mbti]
  return {
    mbti,
    title: base.title,
    interpretation: base.interpretation,
  }
}

