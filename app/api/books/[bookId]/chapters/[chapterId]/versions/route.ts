import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

/**
 * GET /api/books/[bookId]/chapters/[chapterId]/versions
 * 获取章节版本历史
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, bookId } })
  if (!chapter) {
    return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 })
  }

  const versions = await prisma.chapterVersion.findMany({
    where: { chapterId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: versions })
}
