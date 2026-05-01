import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { generateSummary } from '@/lib/ai/generateSummary'
import { extractMemory } from '@/lib/ai/extractMemory'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

async function recordPostFinalizeError(
  bookId: string,
  chapterId: string,
  taskType: 'chapter_summary' | 'extract_memory',
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error)
  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType,
      model: 'unknown',
      result: 'error',
      errorMessage: message.slice(0, 1000),
    },
  })
}

async function runPostFinalizeTasks(bookId: string, chapterId: string) {
  if (process.env.SKIP_AI_POST_FINALIZE === '1') return

  try {
    await generateSummary({ chapterId })
  } catch (error) {
    console.error('Generate summary failed:', error)
    await recordPostFinalizeError(bookId, chapterId, 'chapter_summary', error)
  }

  try {
    await extractMemory({ bookId, chapterId })
  } catch (error) {
    console.error('Extract memory failed:', error)
    await recordPostFinalizeError(bookId, chapterId, 'extract_memory', error)
  }
}

/**
 * POST /api/books/[bookId]/chapters/[chapterId]/save-final
 * 保存定稿
 *
 * 触发条件：用户点击"保存定稿"
 * 副作用：
 * 1. 更新 Chapter.finalContent
 * 2. 更新 Chapter.status = finalized
 * 3. 创建 ChapterVersion（final）
 * 4. 触发记忆提取（可选，或前端单独调用 extract-memory）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params
  const body = await request.json()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const existingChapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId },
  })
  if (!existingChapter) {
    return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 })
  }

  const content =
    typeof body.content === 'string' && body.content.trim()
      ? body.content
      : existingChapter.draftContent || existingChapter.finalContent || ''

  if (!content.trim()) {
    return NextResponse.json(
      { success: false, error: 'Cannot finalize an empty chapter' },
      { status: 400 }
    )
  }

  const chapter = await prisma.chapter.update({
    where: { id: chapterId, bookId },
    data: {
      finalContent: content,
      status: 'finalized',
      wordCount: content.replace(/\s/g, '').length,
    },
  })

  // 创建版本记录
  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'final',
      content,
      note: body.note || '用户定稿',
    },
  })

  // 自动生成高质量摘要并基于定稿提取记忆，不阻塞保存响应。
  runPostFinalizeTasks(bookId, chapterId).catch((error) => {
    console.error('Post-finalize tasks failed:', error)
  })

  return NextResponse.json({ success: true, data: chapter, memoryTriggered: true })
}
