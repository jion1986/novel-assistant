import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  genre: z.string().min(1).max(100),
  coreIdea: z.string().min(1).max(2000),
  targetWords: z.number().int().min(1000).max(10000000).optional().nullable(),
  style: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/books
 * 获取所有小说项目列表
 */
export async function GET(request: NextRequest) {
  const session = await readSession(request)
  const userId = session.userId!
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ success: true, data: books })
}

/**
 * POST /api/books
 * 创建新小说项目
 */
export async function POST(request: NextRequest) {
  const session = await readSession(request)
  const userId = session.userId!
  const body = await request.json()

  const parsed = createBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const book = await prisma.book.create({
    data: { ...parsed.data, userId },
  })

  return NextResponse.json({ success: true, data: book }, { status: 201 })
}
