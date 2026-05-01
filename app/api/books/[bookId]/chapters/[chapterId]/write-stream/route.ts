import { NextRequest } from 'next/server'
import { callModelStream } from '@/lib/ai/multiModelClient'
import { prisma } from '@/lib/db'
import { readSession } from '@/lib/session'
import { estimateCost } from '@/lib/ai/utils'
import { buildWriteChapterContext } from '@/lib/ai/writeContext'

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
    const { prompt, estimatedInputTokens } = await buildWriteChapterContext({ bookId, chapterId, userId })
    const modelName = 'moonshot-v1-8k'

    // 预先创建 GenerationRun（输出 tokens 在流完成后由前端补充或留空）
    await prisma.generationRun.create({
      data: {
        bookId,
        chapterId,
        taskType: 'write',
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
        model: modelName,
        result: 'streaming',
        costEstimate: estimateCost(estimatedInputTokens, 0),
      },
    })

    const stream = await callModelStream({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的小说写手。请写出节奏紧凑、人物鲜活的章节正文。严格控制在目标字数区间内，达到区间后立即收束，不要输出章节标题。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      maxTokens: 4200,
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
