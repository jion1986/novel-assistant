import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, estimateCost } from './utils'
import { generateTempSummary } from './generateSummary'
import type { Chapter } from '@prisma/client'

export interface WriteChapterInput {
  bookId: string
  chapterId: string
}

export interface WriteChapterResult {
  chapter: Chapter
}

/**
 * 生成章节正文
 */
export async function writeChapter(input: WriteChapterInput): Promise<WriteChapterResult> {
  const { bookId, chapterId } = input

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
    },
  })
  if (!book) throw new Error(`Book not found: ${bookId}`)

  const chapter = book.chapters.find(c => c.id === chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  // 获取最近3章定稿的摘要
  const previousChapters = book.chapters
    .filter(c => c.chapterNumber < chapter.chapterNumber && c.status === 'finalized')
    .sort((a, b) => b.chapterNumber - a.chapterNumber)
    .slice(0, 3)

  const previousSummaries = previousChapters
    .map(c => `第${c.chapterNumber}章《${c.title}》: ${c.summary || '无摘要'}`)
    .join('\n')

  // 活跃伏笔
  const activeForeshadowings = await prisma.foreshadowing.findMany({
    where: { bookId, status: { in: ['planted', 'developed'] } },
  })

  // 记忆库摘要
  const memoryItems = await prisma.memoryItem.findMany({
    where: { bookId, isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const template = await loadPromptTemplate('write_chapter.md')
  const prompt = fillTemplate(template, {
    storyBible: JSON.stringify(book.storyBible),
    characters: book.characters.map(c => `${c.name}: ${c.currentStatus || c.personality}`).join('\n'),
    chapterGoal: chapter.chapterGoal || '',
    chapterPlan: chapter.outline || '',
    previousSummaries: previousSummaries || '无前文',
    activeForeshadowings: activeForeshadowings.map(f => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无活跃伏笔',
    memorySummary: memoryItems.map(m => `[${m.type}] ${m.content}`).join('\n') || '无记忆',
    styleGuide: book.storyBible?.styleGuide || book.style || '',
    targetWords: String(3000),
  })

  // 压缩上下文，控制输入长度
  const compressedPrompt = prompt.slice(0, 12000)

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的小说写手，擅长根据大纲和上下文写出节奏紧凑、人物鲜活、伏笔自然的小说章节。你写的文字要有人味，避免AI腔。你必须达到目标字数，不要输出章节标题。' },
      { role: 'user', content: compressedPrompt },
    ],
    temperature: 0.75,
    maxTokens: 8000,
  })

  // 生成临时摘要（确保后续章节有前文参考）
  const tempSummary = generateTempSummary(callResult.content)

  // 保存草稿
  const updatedChapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      draftContent: callResult.content,
      status: 'ai_draft',
      wordCount: callResult.content.length,
      summary: tempSummary,
    },
  })

  // 创建版本记录
  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'ai_draft',
      content: callResult.content,
      note: `AI 生成，模型: ${callResult.model}`,
    },
  })

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'write',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { chapter: updatedChapter }
}
