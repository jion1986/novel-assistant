import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'

interface RouteParams {
  params: Promise<{ bookId: string }>
}

/**
 * GET /api/books/[bookId]/export?format=markdown|txt
 * 导出整本小说
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'markdown'

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
      chapters: {
        where: { status: 'finalized' },
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })

  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  const lines: string[] = []

  if (format === 'markdown') {
    lines.push(`# ${book.title}`)
    lines.push('')
    lines.push(`**题材**: ${book.genre}`)
    lines.push('')
    if (book.storyBible) {
      lines.push('## 世界观')
      lines.push(book.storyBible.worldSetting)
      lines.push('')
      lines.push('## 核心冲突')
      lines.push(book.storyBible.coreConflict)
      lines.push('')
    }
    if (book.characters.length > 0) {
      lines.push('## 角色')
      for (const char of book.characters) {
        lines.push(`- **${char.name}** (${char.role}): ${char.personality || ''}`)
      }
      lines.push('')
    }
    for (const ch of book.chapters) {
      lines.push(`## 第${ch.chapterNumber}章 ${ch.title}`)
      lines.push('')
      lines.push(ch.finalContent || '')
      lines.push('')
    }
  } else {
    // TXT 格式
    lines.push(book.title)
    lines.push(`题材: ${book.genre}`)
    lines.push('')
    if (book.storyBible) {
      lines.push('【世界观】')
      lines.push(book.storyBible.worldSetting)
      lines.push('')
    }
    for (const ch of book.chapters) {
      lines.push(`第${ch.chapterNumber}章 ${ch.title}`)
      lines.push('')
      lines.push(ch.finalContent || '')
      lines.push('')
    }
  }

  const content = lines.join('\n')

  return new NextResponse(content, {
    headers: {
      'Content-Type': format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${book.title}.${format === 'markdown' ? 'md' : 'txt'}"`,
    },
  })
}
