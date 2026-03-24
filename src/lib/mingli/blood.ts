import type { BloodType, BloodTypeResult } from '../types'

const mapping: Record<BloodType, { title: string; interpretation: string }> = {
  A: {
    title: 'A 型血：细腻与责任感',
    interpretation:
      '你更在意秩序与品质，做事认真、考虑周到。你可能倾向于“替别人想”，在压力来时也会自我消化。建议：把担心变成计划，用温柔但明确的表达替代默默承担。',
  },
  B: {
    title: 'B 型血：独立与弹性',
    interpretation:
      '你有自己的节奏，面对变化也更能适应。你可能外柔内固，善于在不同场景切换角色。提醒：别让“随心”变成“缺乏方向”，给热情一个可落地的目标。',
  },
  AB: {
    title: 'AB 型血：兼容与理性',
    interpretation:
      '你兼具理性与感性，能在两种视角间切换。你通常不随波逐流，愿意深度理解后再决定。需要注意：有时你会想太多，试着把复杂化简化，让行动先跑起来。',
  },
  O: {
    title: 'O 型血：行动与包容',
    interpretation:
      '你更倾向于直接行动，重视效率与真实感。你能理解他人的需要，通常也有较强的社交魅力。挑战在于：别把承担变成默认，把需求说出口，你会更轻松。',
  },
}

export function calcBloodType(bloodType: BloodType): BloodTypeResult {
  const base = mapping[bloodType]
  return {
    bloodType,
    title: base.title,
    interpretation: base.interpretation,
  }
}

