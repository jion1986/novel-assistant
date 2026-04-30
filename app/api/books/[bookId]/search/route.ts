import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

/**
 * GET /api/books/[bookId]/search?q=keyword
 * 全文搜索：章节标题、章节内容、记忆条目、角色
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  if (!q || q.length < 2) {
    return NextResponse.json(
      { success: false, error: '搜索关键词至少 2 个字符' },
      { status: 400 }
    )
  }

  const keyword = q

  const [chapters, memoryItems, characters] = await Promise.all([
    prisma.chapter.findMany({
      where: {
        bookId,
        OR: [
          { title: { contains: keyword } },
          { draftContent: { contains: keyword } },
          { finalContent: { contains: keyword } },
          { summary: { contains: keyword } },
        ],
      },
      orderBy: { chapterNumber: 'asc' },
      take: 20,
    }),
    prisma.memoryItem.findMany({
      where: {
        bookId,
        content: { contains: keyword },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.character.findMany({
      where: {
        bookId,
        OR: [
          { name: { contains: keyword } },
          { personality: { contains: keyword } },
          { currentStatus: { contains: keyword } },
        ],
      },
      orderBy: { orderIndex: 'asc' },
      take: 10,
    }),
  ])

  // 高亮匹配片段
  function extractSnippet(text: string | null, keyword: string, maxLen = 80): string {
    if (!text) return ''
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
    if (idx === -1) return text.slice(0, maxLen)
    const start = Math.max(0, idx - 30)
    const end = Math.min(text.length, idx + keyword.length + 30)
    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
  }

  const results = {
    chapters: chapters.map((ch) => ({
      id: ch.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      snippet: extractSnippet(ch.draftContent || ch.finalContent || ch.summary, keyword),
      status: ch.status,
    })),
    memoryItems: memoryItems.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      snippet: extractSnippet(m.content, keyword),
    })),
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      snippet: extractSnippet(c.currentStatus || c.personality, keyword),
    })),
  }

  return NextResponse.json({ success: true, data: results, query: keyword })
}
