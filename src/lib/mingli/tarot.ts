import type { BirthDateInput, TarotCard, TarotResult } from '../types'
import { hashStringToUint32, mulberry32, pickUnique } from '../random/seededRng'

const majorArcana: TarotCard[] = [
  { id: 0, name: '愚者 The Fool', keywords: ['新开始', '自由', '冒险'], meaningUpright: '你正处在一次“从零出发”的节点。允许自己不完美，把好奇心当作方向，向前走比想太多更重要。' },
  { id: 1, name: '魔术师 The Magician', keywords: ['意志', '沟通', '资源'], meaningUpright: '你拥有把想法变成现实的能力。把注意力收回来：明确目标、动手验证，你会看到因果连接。' },
  { id: 2, name: '女祭司 The High Priestess', keywords: ['直觉', '潜意识', '沉默'], meaningUpright: '答案可能不在外界，而在你内在的感受。保持观察与倾听，用直觉做初步判断，再用证据校准。' },
  { id: 3, name: '女皇 The Empress', keywords: ['丰盛', '滋养', '创造'], meaningUpright: '你需要更好地照顾自己。创造力会在“允许生长”的氛围中自然出现：从小处开始，持续投入。' },
  { id: 4, name: '皇帝 The Emperor', keywords: ['秩序', '边界', '掌控'], meaningUpright: '建立规则与边界，事情会更可控。你要把责任落实到系统，而不是只靠情绪硬撑。' },
  { id: 5, name: '教皇 The Hierophant', keywords: ['传统', '承诺', '学习'], meaningUpright: '向权威/传统学习，或与价值观一致的人建立承诺。系统化的训练会带来稳定提升。' },
  { id: 6, name: '恋人 The Lovers', keywords: ['选择', '关系', '价值一致'], meaningUpright: '面临选择：真正重要的是“价值是否一致”。诚实沟通会让关系进入更清晰的轨道。' },
  { id: 7, name: '战车 The Chariot', keywords: ['推进', '胜任', '方向'], meaningUpright: '把能量集中到单一方向。你能赢在坚持：把目标拆小，用可测量的步骤推进。' },
  { id: 8, name: '力量 Strength', keywords: ['勇气', '温柔的坚持', '自信'], meaningUpright: '真正的力量来自自我接纳。用温和但坚定的方式跨过阻力，你会更快找到节奏。' },
  { id: 9, name: '隐者 The Hermit', keywords: ['独处', '觉察', '答案'], meaningUpright: '需要一段安静的时间来整理内心。你的答案会在沉淀中出现：少看噪音，多看真实。' },
  { id: 10, name: '命运之轮 Wheel of Fortune', keywords: ['转机', '周期', '运势'], meaningUpright: '命运正转动。把握机会、顺势而为，同时也要对变化保持弹性：你越准备充分，越能接住好运。' },
  { id: 11, name: '正义 Justice', keywords: ['公平', '规则', '因果'], meaningUpright: '回到事实与原则。做决定时遵循边界与证据，你会获得更长期的公正与稳定。' },
  { id: 12, name: '倒吊人 The Hanged Man', keywords: ['暂停', '换角度', '牺牲'], meaningUpright: '暂时的停顿不是失败，而是换角度。你需要重新看待问题，直到答案浮出水面。' },
  { id: 13, name: '死亡 Death', keywords: ['结束', '重生', '转化'], meaningUpright: '一段旧模式需要告别。放下之后，你会进入新的秩序：先清理，再重新构建。' },
  { id: 14, name: '节制 Temperance', keywords: ['平衡', '调和', '耐心'], meaningUpright: '你需要的是“刚好”的平衡。用更温和的方式整合不同需求，循序渐进会带来惊喜。' },
  { id: 15, name: '恶魔 The Devil', keywords: ['欲望', '束缚', '觉醒'], meaningUpright: '注意你被什么牵制：可能是执念、依赖或逃避。看清束缚的来源，你就能重回选择权。' },
  { id: 16, name: '高塔 The Tower', keywords: ['突变', '真相', '重建'], meaningUpright: '现实正在“强制纠偏”。当结构不再适合你，请允许它倒下；然后用新逻辑重建。' },
  { id: 17, name: '星星 The Star', keywords: ['希望', '修复', '愿望'], meaningUpright: '有复原的力量。持续做对的事，你会慢慢看到光：希望不是等来的，是行动一点点堆出来的。' },
  { id: 18, name: '月亮 The Moon', keywords: ['直觉', '迷雾', '不确定'], meaningUpright: '你可能处于信息不完整的阶段。不要急着下结论，先观察细节与模式，再做决定。' },
  { id: 19, name: '太阳 The Sun', keywords: ['成功', '清明', '喜悦'], meaningUpright: '局势正在变好。把真实表达出来，你会获得更明亮的支持与结果。' },
  { id: 20, name: '审判 Judgement', keywords: ['复盘', '觉醒', '新机会'], meaningUpright: '是时候为过去做总结，并迎接新的召唤。你越诚实面对自己，就越能把机会抓住。' },
  { id: 21, name: '世界 The World', keywords: ['完成', '整合', '新阶段'], meaningUpright: '一个循环接近完成。你已经学会了关键课题：接下来把经验整合到新目标里，会更顺。' },
]

export function calcTarot(
  birth: BirthDateInput,
  seedExtra: string,
): TarotResult {
  const seedBase = `${birth.year}-${birth.month}-${birth.day}-${birth.hour}|${seedExtra}`
  const seed = hashStringToUint32(seedBase)
  const rng = mulberry32(seed)
  const picks = pickUnique(majorArcana, 3, rng)
  const positions: ('过去' | '现在' | '未来')[] = ['过去', '现在', '未来']
  return {
    picks: picks.map((card, idx) => ({
      position: positions[idx]!,
      card,
    })),
  }
}

