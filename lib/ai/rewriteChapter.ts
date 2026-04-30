import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, estimateCost } from './utils'
import type { Chapter } from '@prisma/client'

export interface RewriteChapterInput {
  bookId: string
  chapterId: string
  instruction: string
  styleReference?: string
}

export interface RewriteChapterResult {
  chapter: Chapter
}

/**
 * 改写章节
 */
export async function rewriteChapter(input: RewriteChapterInput): Promise<RewriteChapterResult> {
  const { bookId, chapterId, instruction, styleReference } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { book: { include: { storyBible: true } } },
  })
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  const contentToRewrite = chapter.finalContent || chapter.draftContent
  if (!contentToRewrite) throw new Error('Chapter has no content to rewrite')

  const template = await loadPromptTemplate('rewrite_chapter.md')
  const prompt = fillTemplate(template, {
    originalContent: contentToRewrite,
    rewriteInstruction: instruction,
    styleReference: styleReference || '',
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的小说编辑，擅长根据修改意见改写小说章节。你保持核心情节不变，只调整表达方式和细节。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 6000,
  })

  // 保存改写后的草稿
  const updatedChapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      draftContent: callResult.content,
      status: 'ai_draft',
      wordCount: callResult.content.length,
    },
  })

  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'ai_draft',
      content: callResult.content,
      note: `改写: ${instruction.slice(0, 100)}`,
    },
  })

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'rewrite',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { chapter: updatedChapter }
}
