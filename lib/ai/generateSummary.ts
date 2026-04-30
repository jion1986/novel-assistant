import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { estimateCost } from './utils'

export interface GenerateSummaryInput {
  chapterId: string
}

export interface GenerateSummaryResult {
  summary: string
}

/**
 * 为章节生成高质量摘要（200字以内）
 *
 * 用于：
 * 1. save-final 后自动生成定稿摘要
 * 2. 为后续章节的 previousSummaries 提供上下文
 */
export async function generateSummary(input: GenerateSummaryInput): Promise<GenerateSummaryResult> {
  const { chapterId } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
  })
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  const content = chapter.finalContent || chapter.draftContent
  if (!content) throw new Error('Chapter has no content')

  const callResult = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是一个专业的小说编辑，擅长用精炼的语言概括章节内容。你只输出摘要文本，不要有任何前缀、标题或格式标记。摘要需要包含：核心事件、关键角色行动、情绪转折。控制在150-200字。',
      },
      {
        role: 'user',
        content: `请为以下小说章节生成摘要（150-200字）：\n\n章节标题：${chapter.title}\n\n${content.slice(0, 8000)}`,
      },
    ],
    temperature: 0.4,
    maxTokens: 500,
  })

  const summary = callResult.content.trim().replace(/^["""']|["""']$/g, '')

  // 保存到数据库
  await prisma.chapter.update({
    where: { id: chapterId },
    data: { summary: summary.slice(0, 500) },
  })

  // 记录成本
  await prisma.generationRun.create({
    data: {
      bookId: chapter.bookId,
      chapterId,
      taskType: 'chapter_summary',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { summary: summary.slice(0, 500) }
}

/**
 * 生成临时摘要（草稿阶段，低成本）
 * 取正文前300字作为临时摘要，确保后续章节有上下文参考
 */
export function generateTempSummary(content: string): string {
  const clean = content
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (clean.length <= 300) return clean

  // 找第300字附近的句号，避免截断在句子中间
  const slice = clean.slice(0, 350)
  const lastPeriod = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'))
  if (lastPeriod > 200) {
    return slice.slice(0, lastPeriod + 1)
  }
  return clean.slice(0, 300) + '……'
}
