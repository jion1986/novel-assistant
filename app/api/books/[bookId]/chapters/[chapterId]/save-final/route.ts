import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { generateSummary } from '@/lib/ai/generateSummary'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
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

  const chapter = await prisma.chapter.update({
    where: { id: chapterId, bookId },
    data: {
      finalContent: body.content,
      status: 'finalized',
      wordCount: body.content?.length || 0,
    },
  })

  // 创建版本记录
  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'final',
      content: body.content,
      note: body.note || '用户定稿',
    },
  })

  // 自动生成高质量摘要（不阻塞响应）
  generateSummary({ chapterId }).catch((err) => {
    console.error('Generate summary failed:', err)
  })

  return NextResponse.json({ success: true, data: chapter })
}
