import { NextRequest, NextResponse } from 'next/server'
import { generateOutline } from '@/lib/ai/generateOutline'
import { readSession } from '@/lib/session'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

/**
 * POST /api/books/[bookId]/outline/generate
 * 生成全书大纲和分章计划
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
    const result = await generateOutline({ bookId })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
