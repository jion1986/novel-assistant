import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RewritePanel } from '../rewrite-panel'

describe('RewritePanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('对编辑器选中文本请求局部改写并应用到原位置', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          rewrittenText: '新的冲突入口。',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onReplace = vi.fn()
    const content = '前文。需要改写的片段。后文。'

    render(
      <>
        <textarea defaultValue={content} aria-label="章节正文" data-editor="main" />
        <RewritePanel bookId="book-1" chapterId="chapter-1" content={content} onReplace={onReplace} />
      </>
    )

    const textarea = screen.getByLabelText('章节正文') as HTMLTextAreaElement
    textarea.setSelectionRange(3, 11)
    fireEvent.click(screen.getByRole('button', { name: '1. 先在编辑器中选中文字，再点击这里' }))

    fireEvent.change(screen.getByPlaceholderText('2. 输入改写要求（如：润色、扩写、精简）'), {
      target: { value: '加强冲突' },
    })
    fireEvent.click(screen.getByRole('button', { name: '3. 开始改写' }))

    await screen.findByText('新的冲突入口。')
    fireEvent.click(screen.getByRole('button', { name: '应用改写' }))

    await waitFor(() => {
      expect(onReplace).toHaveBeenCalledWith('前文。新的冲突入口。后文。')
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/books/book-1/chapters/chapter-1/rewrite-selection',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })
})
