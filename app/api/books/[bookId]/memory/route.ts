import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

const createSchema = z.object({
  type: z.enum(['character', 'event', 'location', 'item', 'rule', 'relationship']),
  content: z.string().min(1).max(2000),
  importance: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  relatedChapter: z.string().optional().nullable(),
})

const patchSchema = z.object({
  type: z.enum(['character', 'event', 'location', 'item', 'rule', 'relationship']).optional(),
  content: z.string().min(1).max(2000).optional(),
  importance: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  isActive: z.boolean().optional(),
  relatedChapter: z.string().optional().nullable(),
})

/**
 * GET /api/books/[bookId]/memory
 * 获取记忆库数据
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const [memoryItems, foreshadowings, characters] = await Promise.all([
    prisma.memoryItem.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.foreshadowing.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.character.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: { memoryItems, foreshadowings, characters },
  })
}

/**
 * POST /api/books/[bookId]/memory
 * 创建新记忆条目
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

  const item = await prisma.memoryItem.create({
    data: {
      bookId,
      type: parsed.data.type,
      content: parsed.data.content,
      importance: parsed.data.importance || 'normal',
      relatedChapter: parsed.data.relatedChapter || '',
      isActive: true,
    },
  })

  return NextResponse.json({ success: true, data: item }, { status: 201 })
}

/**
 * PATCH /api/books/[bookId]/memory
 * 批量更新或更新单条记忆（通过 query param id）
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const { searchParams } = new URL(request.url)
  const memoryId = searchParams.get('id')

  if (!memoryId) {
    return NextResponse.json({ success: false, error: 'Missing id query param' }, { status: 400 })
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const body = await request.json()

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const item = await prisma.memoryItem.update({
    where: { id: memoryId, bookId },
    data: parsed.data,
  })

  return NextResponse.json({ success: true, data: item })
}

/**
 * DELETE /api/books/[bookId]/memory
 * 删除记忆条目（通过 query param id）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const { searchParams } = new URL(request.url)
  const memoryId = searchParams.get('id')

  if (!memoryId) {
    return NextResponse.json({ success: false, error: 'Missing id query param' }, { status: 400 })
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  await prisma.memoryItem.delete({ where: { id: memoryId, bookId } })

  return NextResponse.json({ success: true })
}
