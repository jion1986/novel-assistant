import { NextRequest, NextResponse } from 'next/server'
import { generateChapterPlan } from '@/lib/ai/generateChapterPlan'
import { readSession } from '@/lib/session'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

/**
 * POST /api/books/[bookId]/chapters/generate-plans
 * 为所有未写章节生成详细分章计划
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const result = await generateChapterPlan({ bookId })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
