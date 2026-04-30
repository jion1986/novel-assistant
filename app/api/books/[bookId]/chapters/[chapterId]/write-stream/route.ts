import { NextRequest } from 'next/server'
import { callModelStream } from '@/lib/ai/multiModelClient'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { estimateCost } from '@/lib/ai/utils'

interface RouteParams {
  params: Promise<{ bookId: string; chapterId: string }>
}

/**
 * GET /api/books/[bookId]/chapters/[chapterId]/write-stream
 * 流式生成章节正文（SSE）
 *
 * 前端用 fetch + ReadableStream 消费：
 *   const res = await fetch('/write-stream')
 *   const reader = res.body.getReader()
 *   while (...) { const { value } = await reader.read() }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await readSession(request)
  const userId = session.userId!
  const { bookId, chapterId } = await params

  try {
    const book = await prisma.book.findFirst({
      where: { id: bookId, userId },
      include: {
        storyBible: true,
        characters: { orderBy: { orderIndex: 'asc' } },
        chapters: { orderBy: { chapterNumber: 'asc' } },
      },
    })
    if (!book) {
      return new Response('Book not found', { status: 404 })
    }

    const chapter = book.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      return new Response('Chapter not found', { status: 404 })
    }

    // 获取上下文
    const previousChapters = book.chapters
      .filter((c) => c.chapterNumber < chapter.chapterNumber && c.status === 'finalized')
      .sort((a, b) => b.chapterNumber - a.chapterNumber)
      .slice(0, 3)

    const previousSummaries = previousChapters
      .map((c) => `第${c.chapterNumber}章《${c.title}》: ${c.summary || '无摘要'}`)
      .join('\n')

    const activeForeshadowings = await prisma.foreshadowing.findMany({
      where: { bookId, status: { in: ['planted', 'developed'] } },
    })

    const memoryItems = await prisma.memoryItem.findMany({
      where: { bookId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const prompt = `
小说核心设定：
${JSON.stringify(book.storyBible)}

角色状态：
${book.characters.map((c) => `${c.name}: ${c.currentStatus || c.personality}`).join('\n')}

前文摘要：
${previousSummaries || '无前文'}

活跃伏笔：
${activeForeshadowings.map((f) => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无活跃伏笔'}

记忆库：
${memoryItems.map((m) => `[${m.type}] ${m.content}`).join('\n') || '无记忆'}

本章目标：${chapter.chapterGoal || ''}
本章大纲：${chapter.outline || ''}

请根据以上上下文，写出第${chapter.chapterNumber}章《${chapter.title}》的正文。
要求：
1. 必须达到目标字数（约3000字）
2. 保持人物性格一致
3. 自然融入伏笔和记忆
4. 节奏紧凑，有人味，避免AI腔
5. 不要输出章节标题，直接从正文开始
`.slice(0, 12000)

    // 估算输入 tokens（中文字符约 1.5 tokens/字，英文约 0.3）
    const inputTokens = Math.round(prompt.length * 1.2)
    const modelName = 'moonshot-v1-8k'

    // 预先创建 GenerationRun（输出 tokens 在流完成后由前端补充或留空）
    const genRun = await prisma.generationRun.create({
      data: {
        bookId,
        chapterId,
        taskType: 'write',
        inputTokens,
        outputTokens: 0,
        model: modelName,
        result: 'streaming',
        costEstimate: estimateCost(inputTokens, 0),
      },
    })

    const stream = await callModelStream({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的小说写手，擅长根据大纲和上下文写出节奏紧凑、人物鲜活、伏笔自然的小说章节。你写的文字要有人味，避免AI腔。你必须达到目标字数，不要输出章节标题。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      maxTokens: 8000,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(message, { status: 500 })
  }
}
