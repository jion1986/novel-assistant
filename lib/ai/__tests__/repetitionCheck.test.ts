import { describe, expect, it } from 'vitest'
import { analyzeChapterRepetition, buildOpeningAvoidanceNote } from '../repetitionCheck'

describe('repetitionCheck', () => {
  it('从最近章节开头生成避让提示', () => {
    const note = buildOpeningAvoidanceNote([
      {
        chapterNumber: 8,
        title: '秘密的代价',
        content: '艾丽卡站在控制台前，指尖划过控制面板，能量场开始波动。',
      },
      {
        chapterNumber: 9,
        title: '对抗',
        content: '艾丽卡站在控制台前，屏幕上的数据流不断刷新，能量场再次波动。',
      },
      {
        chapterNumber: 10,
        title: '能量场的稳定',
        content: '艾丽卡的手指停在控制面板上，警报和能量场波动同时出现。',
      },
    ])

    expect(note).toContain('控制面板')
    expect(note).toContain('能量场')
    expect(note).toContain('必须避开')
  })

  it('发现当前章节开头与前文开头重复', () => {
    const result = analyzeChapterRepetition(
      {
        chapterNumber: 11,
        title: '星门的呼唤',
        content: '艾丽卡站在控制台前，指尖划过控制面板，屏幕上的数据流像瀑布一样刷新，能量场再次波动。约翰压低声音提醒她必须立刻做决定。',
      },
      [
        {
          chapterNumber: 10,
          title: '能量场的稳定',
          content: '艾丽卡站在控制台前，手指按住控制面板，屏幕上的数据流不断刷新，能量场剧烈波动。',
        },
      ]
    )

    expect(result.issues.some((issue) => issue.type === 'repetition')).toBe(true)
    expect(result.issues[0].description).toContain('第10章')
  })

  it('发现章节内部重复短语', () => {
    const repeated = '能量场波动'
    const result = analyzeChapterRepetition(
      {
        chapterNumber: 3,
        title: '测试',
        content: `${repeated}让所有人停下脚步。${repeated}再次扩大。艾丽卡意识到${repeated}不是偶然。`,
      },
      []
    )

    expect(result.issues.some((issue) => issue.description.includes(repeated))).toBe(true)
  })
})
