import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

const patchBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: z.string().min(1).max(100).optional(),
  coreIdea: z.string().min(1).max(2000).optional(),
  targetWords: z.number().int().min(1000).max(10000000).optional().nullable(),
  style: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  storyBible: z.object({
    worldSetting: z.string(),
    storyType: z.string(),
    tone: z.string(),
    coreConflict: z.string(),
    powerSystem: z.string().optional().nullable(),
    rules: z.string().optional().nullable(),
    forbiddenChanges: z.string().optional().nullable(),
    styleGuide: z.string().optional().nullable(),
    sellingPoints: z.string().optional().nullable(),
  }).optional(),
})

/**
 * GET /api/books/[bookId]
 * 获取小说详情（含设定、角色、章节、记忆）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
      memoryItems: { where: { isActive: true } },
      foreshadowings: true,
      generationRuns: true,
    },
  })

  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: book })
}

/**
 * PATCH /api/books/[bookId]
 * 更新小说基本信息
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const body = await request.json()

  const parsed = patchBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  const { storyBible, ...bookData } = parsed.data

  const book = await prisma.book.update({
    where: { id: bookId, userId },
    data: bookData,
  })

  if (storyBible && bookId) {
    await prisma.storyBible.upsert({
      where: { bookId },
      create: {
        bookId,
        worldSetting: storyBible.worldSetting || '',
        storyType: storyBible.storyType || '',
        tone: storyBible.tone || '',
        coreConflict: storyBible.coreConflict || '',
        powerSystem: storyBible.powerSystem,
        rules: storyBible.rules,
        forbiddenChanges: storyBible.forbiddenChanges,
        styleGuide: storyBible.styleGuide,
        sellingPoints: storyBible.sellingPoints,
      },
      update: {
        worldSetting: storyBible.worldSetting,
        storyType: storyBible.storyType,
        tone: storyBible.tone,
        coreConflict: storyBible.coreConflict,
        powerSystem: storyBible.powerSystem,
        rules: storyBible.rules,
        forbiddenChanges: storyBible.forbiddenChanges,
        styleGuide: storyBible.styleGuide,
        sellingPoints: storyBible.sellingPoints,
      },
    })
  }

  return NextResponse.json({ success: true, data: book })
}

/**
 * DELETE /api/books/[bookId]
 * 删除小说项目
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params

  await prisma.book.delete({ where: { id: bookId, userId } })

  return NextResponse.json({ success: true })
}
