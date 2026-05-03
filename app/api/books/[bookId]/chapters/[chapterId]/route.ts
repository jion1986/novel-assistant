import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { saveChapterToLocal } from '@/lib/localExport'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

const patchChapterSchema = z.object({
  draftContent: z.string().optional(),
  finalContent: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['unwritten', 'ai_draft', 'edited', 'finalized']).optional(),
  wordCount: z.number().int().min(0).optional().nullable(),
  chapterGoal: z.string().optional().nullable(),
  outline: z.string().optional().nullable(),
})

/**
 * GET /api/books/[bookId]/chapters/[chapterId]
 * 获取单章详情（含版本历史）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
    include: {
      versions: { orderBy: { createdAt: 'desc' } },
      generationRuns: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!chapter) {
    return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: chapter })
}

/**
 * PATCH /api/books/[bookId]/chapters/[chapterId]
 * 更新章节内容（编辑保存，非定稿）
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const parsed = patchChapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const chapter = await prisma.chapter.update({
    where: { id: chapterId, bookId },
    data: parsed.data,
  })

  // 如果有内容更新，自动保存到本地
  if (parsed.data.draftContent || parsed.data.finalContent) {
    try {
      const content = parsed.data.finalContent || parsed.data.draftContent || ''
      const status = parsed.data.status || chapter.status
      const localPath = saveChapterToLocal({
        bookTitle: book.title,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        content,
        status,
        wordCount: content.replace(/\s/g, '').length,
      })
      console.log(`  编辑已保存到本地: ${localPath}`)
    } catch (saveError) {
      console.error('保存到本地失败:', saveError)
    }
  }

  return NextResponse.json({ success: true, data: chapter })
}

/**
 * DELETE /api/books/[bookId]/chapters/[chapterId]
 * 删除章节，并重新排序后续章节的 chapterNumber
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
    })

    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 })
    }

    const deletedNumber = chapter.chapterNumber

    await prisma.chapter.delete({ where: { id: chapterId } })

    await prisma.chapter.updateMany({
      where: {
        bookId,
        chapterNumber: { gt: deletedNumber },
      },
      data: {
        chapterNumber: { decrement: 1 },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
