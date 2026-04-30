import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

const reorderSchema = z.object({
  chapterIds: z.array(z.string()).min(1),
})

/**
 * POST /api/books/[bookId]/chapters/reorder
 * 批量重排章节顺序
 *
 * body: { chapterIds: string[] }
 * 按 chapterIds 的顺序重新分配 chapterNumber（1, 2, 3...）
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

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  try {
    // 使用临时值避免唯一键冲突（先移到 10000+，再设正确值）
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < parsed.data.chapterIds.length; i++) {
        await tx.chapter.update({
          where: { id: parsed.data.chapterIds[i], bookId },
          data: { chapterNumber: 10000 + i },
        })
      }
      for (let i = 0; i < parsed.data.chapterIds.length; i++) {
        await tx.chapter.update({
          where: { id: parsed.data.chapterIds[i], bookId },
          data: { chapterNumber: i + 1 },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
