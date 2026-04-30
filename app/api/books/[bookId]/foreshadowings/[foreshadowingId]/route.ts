import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string; foreshadowingId: string }>
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  status: z.enum(['planted', 'developed', 'resolved']).optional(),
  setupChapter: z.string().optional().nullable(),
  resolvePlan: z.string().optional().nullable(),
  resolveChapter: z.string().optional().nullable(),
})

/**
 * PATCH /api/books/[bookId]/foreshadowings/[foreshadowingId]
 * 更新伏笔
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, foreshadowingId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const fw = await prisma.foreshadowing.update({
    where: { id: foreshadowingId, bookId },
    data: parsed.data,
  })

  return NextResponse.json({ success: true, data: fw })
}

/**
 * DELETE /api/books/[bookId]/foreshadowings/[foreshadowingId]
 * 删除伏笔
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, foreshadowingId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  await prisma.foreshadowing.delete({ where: { id: foreshadowingId, bookId } })

  return NextResponse.json({ success: true })
}
