import { NextRequest, NextResponse } from 'next/server'
import { rewriteIssue } from '@/lib/ai/rewriteIssue'
import { readSession } from '@/lib/session'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  if (!body.issue) {
    return NextResponse.json({ success: false, error: 'Missing issue' }, { status: 400 })
  }

  try {
    const result = await rewriteIssue({
      bookId,
      chapterId,
      issue: body.issue,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
