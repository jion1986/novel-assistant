import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string; versionId: string }>
}

/**
 * POST /api/books/[bookId]/chapters/[chapterId]/versions/[versionId]/restore
 * 回退到指定版本
 *
 * 副作用：
 * 1. 将版本内容写入 chapter.draftContent
 * 2. 创建新的 user_edit 版本记录
 * 3. 状态变为 edited
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId, versionId } = await params

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const version = await prisma.chapterVersion.findUnique({
      where: { id: versionId },
    })

    if (!version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    if (version.chapterId !== chapterId) {
      return NextResponse.json({ success: false, error: 'Version does not belong to this chapter' }, { status: 400 })
    }

    const chapter = await prisma.chapter.update({
      where: { id: chapterId, bookId },
      data: {
        draftContent: version.content,
        status: 'edited',
        wordCount: version.content.length,
      },
    })

    // 创建回退记录
    await prisma.chapterVersion.create({
      data: {
        chapterId,
        versionType: 'user_edit',
        content: version.content,
        note: `回退到 ${version.versionType === 'ai_draft' ? 'AI草稿' : version.versionType === 'final' ? '定稿' : '编辑版本'} (${new Date(version.createdAt).toLocaleString()})`,
      },
    })

    return NextResponse.json({ success: true, data: chapter })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
