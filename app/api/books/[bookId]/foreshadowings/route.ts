import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  setupChapter: z.string().optional().nullable(),
  resolvePlan: z.string().optional().nullable(),
})

/**
 * GET /api/books/[bookId]/foreshadowings
 * 获取伏笔列表
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const foreshadowings = await prisma.foreshadowing.findMany({
    where: { bookId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: foreshadowings })
}

/**
 * POST /api/books/[bookId]/foreshadowings
 * 创建新伏笔
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

  const fw = await prisma.foreshadowing.create({
    data: {
      bookId,
      name: parsed.data.name,
      description: parsed.data.description,
      setupChapter: parsed.data.setupChapter || '',
      status: 'planted',
      resolvePlan: parsed.data.resolvePlan || '',
    },
  })

  return NextResponse.json({ success: true, data: fw }, { status: 201 })
}
