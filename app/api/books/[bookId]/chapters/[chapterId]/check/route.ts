import { NextRequest, NextResponse } from 'next/server'
import { checkConsistency } from '@/lib/ai/checkConsistency'
import { readSession } from '@/lib/session'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

/**
 * POST /api/books/[bookId]/chapters/[chapterId]/check
 * 一致性检查
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const result = await checkConsistency({ bookId, chapterId })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
