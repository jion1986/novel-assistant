import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChapterActions } from '../chapter-actions'

describe('ChapterActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('展示一致性检查详情并支持按单个问题改写', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            issues: [
              {
                severity: 'medium',
                type: 'repetition',
                description: '章节开头与前文重复',
                location: '艾丽卡站在控制台前，能量场再次波动。',
                suggestion: '换一个新的冲突入口',
              },
            ],
            score: { overall: 77, readability: 80 },
            summary: '存在重复开头。',
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            chapter: {
              draftContent: '新的章节草稿内容。',
            },
          },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    const onContentReplace = vi.fn()

    render(
      <ChapterActions
        bookId="book-1"
        chapterId="chapter-1"
        status="ai_draft"
        onContentReplace={onContentReplace}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '一致性检查' }))

    await screen.findByText('检查结果')
    expect(screen.getByText('章节开头与前文重复')).toBeInTheDocument()
    expect(screen.getByText('建议：换一个新的冲突入口')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '按建议改写' }))

    await waitFor(() => {
      expect(onContentReplace).toHaveBeenCalledWith('新的章节草稿内容。')
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/books/book-1/chapters/chapter-1/rewrite-issue',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })
})
