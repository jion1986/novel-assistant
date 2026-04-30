/**
 * 生成摘要测试
 */

import { describe, it, expect, vi } from 'vitest'
import { generateSummary } from '../generateSummary'
import { prisma } from '../../db'
import * as kimiClient from '../kimiClient'

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

describe('generateSummary', () => {
  it('章节不存在时抛出错误', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue(null)

    await expect(generateSummary({ chapterId: 'non-existent' })).rejects.toThrow('Chapter not found')
  })

  it('章节无内容时抛出错误', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue({
      id: 'ch1',
      bookId: 'book1',
      title: 'Test',
      finalContent: null,
      draftContent: null,
    } as any)

    await expect(generateSummary({ chapterId: 'ch1' })).rejects.toThrow('Chapter has no content')
  })

  it('成功生成并保存摘要', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValue({
      id: 'ch1',
      bookId: 'book1',
      title: 'Test Chapter',
      finalContent: '这是一段测试内容。',
      draftContent: null,
    } as any)

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
