/** 日主五行与英文标签（用于 UI 配色） */
export type DayMasterInfo = {
  stem: string
  pillar: string
  element: '木' | '火' | '土' | '金' | '水'
  traitEn: 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water'
  /** 展示用：甲木、乙木、… */
  label: string
  /** 一句话意象 */
  oneLiner: string
}

const STEM_META: Record<
  string,
  { element: DayMasterInfo['element']; traitEn: DayMasterInfo['traitEn']; oneLiner: string }
> = {
  甲: {
    element: '木',
    traitEn: 'Wood',
    oneLiner: '如参天大树——具领导力、进取心与正直向上。',
  },
  乙: {
    element: '木',
    traitEn: 'Wood',
    oneLiner: '如藤萝花草——柔韧细腻、善借势、重审美与协调。',
  },
  丙: {
    element: '火',
    traitEn: 'Fire',
    oneLiner: '如太阳当空——热情外放、光明磊落、喜表达与感染他人。',
  },
  丁: {
    element: '火',
    traitEn: 'Fire',
    oneLiner: '如灯烛星火——内敛专注、精细敏锐、重文明与温度。',
  },
  戊: {
    element: '土',
    traitEn: 'Earth',
    oneLiner: '如城垣之土——稳重守信、有担当、宜守成与托举。',
  },
  己: {
    element: '土',
    traitEn: 'Earth',
    oneLiner: '如田园沃土——包容务实、善滋养、重细节与秩序。',
  },
  庚: {
    element: '金',
    traitEn: 'Metal',
    oneLiner: '如刀剑之金——果断坚毅、讲原则、重规则与效率。',
  },
  辛: {
    element: '金',
    traitEn: 'Metal',
    oneLiner: '如珠玉之金——精致敏锐、审美强、善打磨与提炼。',
  },
  壬: {
    element: '水',
    traitEn: 'Water',
    oneLiner: '如江河之水——智慧包容、善流动、视野开阔。',
  },
  癸: {
    element: '水',
    traitEn: 'Water',
    oneLiner: '如雨露之水——灵感细腻、渗透力强、静水深流。',
  },
}

export function parseDayMasterFromDayPillar(dayPillar: string): DayMasterInfo | null {
  const stem = dayPillar.match(/[甲乙丙丁戊己庚辛壬癸]/)?.[0]
  if (!stem) return null
  const meta = STEM_META[stem]
  if (!meta) return null
  return {
    stem,
    pillar: dayPillar,
    element: meta.element,
    traitEn: meta.traitEn,
    label: `${stem}${meta.element}`,
    oneLiner: meta.oneLiner,
  }
}
