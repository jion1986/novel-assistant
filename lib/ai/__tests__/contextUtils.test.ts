import { describe, expect, it } from 'vitest'
import {
  HARD_MAX_CHAPTER_WORDS,
  MIN_CHAPTER_WORDS,
  countContentWords,
  formatCharactersForContext,
  formatMemoryItemsForContext,
  selectRelevantMemoryItems,
  trimChapterToWordLimit,
} from '../contextUtils'

describe('contextUtils', () => {
  it('统计正文时忽略空白字符', () => {
    expect(countContentWords('第一段。\n\n第二 段。')).toBe(8)
  })

  it('优先选择锁定和与本章相关的记忆', () => {
    const selected = selectRelevantMemoryItems(
      [
        {
          type: 'event',
          content: '无关支线：市场里发生了一次争吵。',
          importance: 'normal',
        },
        {
          type: 'rule',
          content: '星门规则：能量场稳定前不能强行穿越。',
          importance: 'critical',
          isLocked: true,
        },
        {
          type: 'item',
          content: '咖啡杯：艾丽卡的旧物。',
          importance: 'low',
        },
      ],
      {
        chapterTitle: '能量场的稳定',
        chapterGoal: '艾丽卡稳定星门能量场',
        chapterPlan: '阻止维克托强行穿越星门',
        maxItems: 2,
      }
    )

    expect(selected).toHaveLength(2)
    expect(selected[0].content).toContain('星门规则')
  })

  it('格式化记忆上下文时遵守字符预算', () => {
    const context = formatMemoryItemsForContext(
      Array.from({ length: 20 }, (_, index) => ({
        type: 'event',
        content: `第${index}条记忆：艾丽卡在星门迷宫中推进调查。`,
        importance: 'normal',
      })),
      { maxChars: 120 }
    )

    expect(context.length).toBeLessThanOrEqual(120)
    expect(context).toContain('[normal][event]')
  })

  it('角色上下文保留锁定事实', () => {
    const context = formatCharactersForContext([
      {
        name: '艾丽卡',
        role: 'protagonist',
        identity: '量子物理学家',
        personality: '冷静',
        currentStatus: '正在调查星门',
        relationships: '信任约翰',
        lockedFacts: '没有子女',
      },
    ])

    expect(context).toContain('锁定事实: 没有子女')
  })

  it('章节过长时按句子边界裁剪到硬上限附近', () => {
    const longText = '艾丽卡推进调查。'.repeat(HARD_MAX_CHAPTER_WORDS)
    const trimmed = trimChapterToWordLimit(longText, 3000)
    const wordCount = countContentWords(trimmed)

    expect(wordCount).toBeGreaterThanOrEqual(MIN_CHAPTER_WORDS)
    expect(wordCount).toBeLessThanOrEqual(3010)
    expect(trimmed.endsWith('。')).toBe(true)
  })
})
