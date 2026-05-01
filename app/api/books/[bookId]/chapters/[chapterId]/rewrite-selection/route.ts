import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { rewriteSelection } from '@/lib/ai/rewriteSelection'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

const rewriteSelectionSchema = z.object({
  selectedText: z.string().min(1).max(8000),
  instruction: z.string().min(1).max(1000),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params
  const body = await request.json()

  const parsed = rewriteSelectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((issue) => issue.message).join(', ') },
      { status: 400 }
    )
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const result = await rewriteSelection({
      bookId,
      chapterId,
      selectedText: parsed.data.selectedText,
      instruction: parsed.data.instruction,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
