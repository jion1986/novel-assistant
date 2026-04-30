import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  chapterNumber: z.number().int().min(1).optional(),
  chapterGoal: z.string().max(1000).optional().nullable(),
  outline: z.string().max(2000).optional().nullable(),
})

/**
 * GET /api/books/[bookId]/chapters
 * 获取章节列表
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { chapterNumber: 'asc' },
  })

  return NextResponse.json({ success: true, data: chapters })
}

/**
 * POST /api/books/[bookId]/chapters
 * 创建新章节（支持指定插入位置）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const { title, chapterNumber, chapterGoal, outline } = parsed.data

  // 确定插入位置
  const maxChapter = await prisma.chapter.findFirst({
    where: { bookId },
    orderBy: { chapterNumber: 'desc' },
  })

  const insertNumber = chapterNumber || (maxChapter ? maxChapter.chapterNumber + 1 : 1)

  // 如果有指定位置且该位置已有章节，需要后移
  if (chapterNumber) {
    await prisma.chapter.updateMany({
      where: {
        bookId,
        chapterNumber: { gte: insertNumber },
      },
      data: {
        chapterNumber: { increment: 1 },
      },
    })
  }

  const chapter = await prisma.chapter.create({
    data: {
      bookId,
      chapterNumber: insertNumber,
      title,
      chapterGoal: chapterGoal || '',
      outline: outline || '',
      status: 'unwritten',
    },
  })

  return NextResponse.json({ success: true, data: chapter }, { status: 201 })
}
