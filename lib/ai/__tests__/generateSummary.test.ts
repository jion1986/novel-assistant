/**
 * 生成摘要测试
 */

import { describe, it, expect, vi } from 'vitest'
import { generateSummary } from '../generateSummary'
import { prisma } from '../../db'
import * as kimiClient from '../kimiClient'
import type { Chapter } from '@prisma/client'

vi.mock('../../db', () => ({
  prisma: {
    chapter: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    generationRun: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../kimiClient', () => ({
  callKimi: vi.fn(),
}))

function testChapter(overrides: Partial<Chapter>): Chapter {
  return {
    id: 'ch1',
    bookId: 'book1',
    chapterNumber: 1,
    title: 'Test',
    chapterGoal: null,
    outline: null,
    draftContent: null,
    finalContent: null,
    summary: null,
    status: 'unwritten',
    wordCount: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('generateSummary', () => {
  it('章节不存在时抛出错误', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue(null)

    await expect(generateSummary({ chapterId: 'non-existent' })).rejects.toThrow('Chapter not found')
  })

  it('章节无内容时抛出错误', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue(testChapter({ id: 'ch1' }))

    await expect(generateSummary({ chapterId: 'ch1' })).rejects.toThrow('Chapter has no content')
  })

  it('成功生成并保存摘要', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue(testChapter({
      title: 'Test Chapter',
      finalContent: '这是一段测试内容。',
    }))

    vi.mocked(kimiClient.callKimi).mockResolvedValue({
      content: '  "测试摘要"  ',
      inputTokens: 100,
      outputTokens: 20,
      model: 'moonshot-v1-8k',
    })

    const result = await generateSummary({ chapterId: 'ch1' })

    expect(result.summary).toBe('测试摘要')
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch1' },
        data: expect.objectContaining({ summary: '测试摘要' }),
      })
    )
    expect(prisma.generationRun.create).toHaveBeenCalled()
  })
})
