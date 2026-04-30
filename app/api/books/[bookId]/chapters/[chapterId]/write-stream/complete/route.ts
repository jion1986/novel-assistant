import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { estimateCost } from '@/lib/ai/utils'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

/**
 * POST /api/books/[bookId]/chapters/[chapterId]/write-stream/complete
 * 流式生成完成后，补录输出 tokens 和成本
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  const body = await request.json()
  const outputTokens = body.outputTokens || 0

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  // 找到最近的流式生成记录并更新
  const genRun = await prisma.generationRun.findFirst({
    where: { bookId, chapterId, taskType: 'write', result: 'streaming' },
    orderBy: { createdAt: 'desc' },
  })

  if (genRun) {
    await prisma.generationRun.update({
      where: { id: genRun.id },
      data: {
        outputTokens,
        result: 'success',
        costEstimate: estimateCost(genRun.inputTokens || 0, outputTokens),
      },
    })
  }

  return NextResponse.json({ success: true })
}
