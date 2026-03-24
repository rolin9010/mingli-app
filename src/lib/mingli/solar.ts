import type { BirthDateInput, SolarSignResult } from '../types'

type Zodiac = {
  sign: string
  range: string
  from: [number, number] // [month, day]
  to: [number, number]
  traits: string
}

const zodiacs: Zodiac[] = [
  {
    sign: '白羊座',
    range: '3/21 - 4/19',
    from: [3, 21],
    to: [4, 19],
    traits: '行动力强，直觉敏锐，喜欢快速启动；也容易冲动，需学会停下来倾听与校准。',
  },
  {
    sign: '金牛座',
    range: '4/20 - 5/20',
    from: [4, 20],
    to: [5, 20],
    traits: '重视稳定与真实感，擅长长期经营；对变化敏感，慢热但一旦确定就很可靠。',
  },
  {
    sign: '双子座',
    range: '5/21 - 6/21',
    from: [5, 21],
    to: [6, 21],
    traits: '思维灵活、学习力强，爱交流也爱新信息；注意别把注意力分散到太多方向。',
  },
  {
    sign: '巨蟹座',
    range: '6/22 - 7/22',
    from: [6, 22],
    to: [7, 22],
    traits: '情感细腻、护家意识强，重视安全感；容易敏感多想，给自己一个更温柔的节奏。',
  },
  {
    sign: '狮子座',
    range: '7/23 - 8/22',
    from: [7, 23],
    to: [8, 22],
    traits: '自信、有舞台感，喜欢被看见；也别忘了在坚持与谦逊之间找平衡。',
  },
  {
    sign: '处女座',
    range: '8/23 - 9/22',
    from: [8, 23],
    to: [9, 22],
    traits: '追求细节与效率，理性且谨慎；容易对自己苛刻，试试把“完美”换成“可持续”。',
  },
  {
    sign: '天秤座',
    range: '9/23 - 10/23',
    from: [9, 23],
    to: [10, 23],
    traits: '审美与社交能力强，擅长协调资源；在犹豫上耗能较大，需练习做决定。',
  },
  {
    sign: '天蝎座',
    range: '10/24 - 11/21',
    from: [10, 24],
    to: [11, 21],
    traits: '深度、洞察与专注是你的底色；直觉准但也容易情绪上头，学会把力量用于长期目标。',
  },
  {
    sign: '射手座',
    range: '11/22 - 12/21',
    from: [11, 22],
    to: [12, 21],
    traits: '乐观、行动与探索驱动你成长；注意别只追新鲜感，给热情落地的机会。',
  },
  {
    sign: '摩羯座',
    range: '12/22 - 1/19',
    from: [12, 22],
    to: [1, 19],
    traits: '务实、耐心、有规划感；你更擅长靠行动证明自己，而不是靠情绪表达。',
  },
  {
    sign: '水瓶座',
    range: '1/20 - 2/18',
    from: [1, 20],
    to: [2, 18],
    traits: '独立思考、创意与格局感强；你可能看起来冷静，实际上对理想很执着。',
  },
  {
    sign: '双鱼座',
    range: '2/19 - 3/20',
    from: [2, 19],
    to: [3, 20],
    traits: '敏感、共情力强，想象与直觉都很发达；记得用边界保护自己，避免过度吸收他人情绪。',
  },
]

function within(month: number, day: number, from: [number, number], to: [number, number]) {
  const [fm, fd] = from
  const [tm, td] = to
  if (fm <= tm) {
    // 同一年内区间
    return (month > fm || (month === fm && day >= fd)) && (month < tm || (month === tm && day <= td))
  }
  // 跨年区间（摩羯、双鱼）
  return (month > fm || (month === fm && day >= fd)) || (month < tm || (month === tm && day <= td))
}

export function calcSolarSign(birth: BirthDateInput): SolarSignResult {
  const { month, day } = birth
  const hit = zodiacs.find((z) => within(month, day, z.from, z.to)) ?? zodiacs[0]
  return {
    sign: hit.sign,
    range: hit.range,
    traits: hit.traits,
  }
}

