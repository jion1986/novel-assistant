import { NextRequest, NextResponse } from 'next/server'
import { callKimi } from '@/lib/ai/kimiClient'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { estimateCost } from '@/lib/ai/utils'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

/**
 * POST /api/books/[bookId]/chapters/[chapterId]/continue
 * 从当前内容末尾续写
 *
 * body: { wordCount?: number } — 续写字数，默认 500
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params
  const body = await request.json()
  const targetWords = body.wordCount || 500

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } })
  if (!book) {
    return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 })
  }

  try {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      include: {
        book: { include: { storyBible: true, characters: { orderBy: { orderIndex: 'asc' } } } },
      },
    })

    if (!chapter) {
      return NextResponse.json({ success: false, error: 'Chapter not found' }, { status: 404 })
    }

    const currentContent = chapter.draftContent || chapter.finalContent || ''

    const prompt = `请根据以下上下文，续写小说内容。

当前已写内容：
${currentContent.slice(-2000)}

本章目标：${chapter.chapterGoal || ''}
本章大纲：${chapter.outline || ''}

角色状态：
${chapter.book.characters.map((c) => `${c.name}: ${c.currentStatus || c.personality}`).join('\n')}

要求：
1. 直接从当前内容的下一句开始续写，不要重复已有内容
2. 续写约 ${targetWords} 字
3. 保持人物性格和文风一致
4. 自然推进情节
5. 不要输出章节标题`

    const callResult = await callKimi({
      messages: [
        { role: 'system', content: '你是一个专业的小说写手，擅长根据上下文自然续写。你只输出续写的新内容，不要重复已有内容。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      maxTokens: 4000,
    })

    const newContent = currentContent + '\n' + callResult.content

    // 自动保存
    await prisma.chapter.update({
      where: { id: chapterId, bookId },
      data: {
        draftContent: newContent,
        status: 'edited',
        wordCount: newContent.length,
      },
    })

    await prisma.generationRun.create({
      data: {
        bookId,
        chapterId,
        taskType: 'continue',
        inputTokens: callResult.inputTokens,
        outputTokens: callResult.outputTokens,
        model: callResult.model,
        result: 'success',
        costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
      },
    })

    return NextResponse.json({ success: true, data: { content: callResult.content, fullContent: newContent } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
