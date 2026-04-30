import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import type { Chapter } from '@prisma/client'

export interface GenerateOutlineInput {
  bookId: string
}

export interface GenerateOutlineResult {
  chapters: Chapter[]
}

interface OutlineChapter {
  chapterNumber: number
  title: string
  goal: string
  keyEvents: string[]
  characters: string[]
  foreshadowing: string[]
  endingHook: string
}

interface OutlineVolume {
  volumeNumber: number
  title: string
  goal: string
  chapters: OutlineChapter[]
}

interface OutlineOutput {
  volumes: OutlineVolume[]
}

/**
 * 生成全书大纲和分章计划
 *
 * 生成大纲后，为每一章创建 Chapter 记录（status = unwritten）
 */
export async function generateOutline(input: GenerateOutlineInput): Promise<GenerateOutlineResult> {
  const { bookId } = input

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
    },
  })
  if (!book) throw new Error(`Book not found: ${bookId}`)

  const template = await loadPromptTemplate('generate_outline.md')
  const prompt = fillTemplate(template, {
    storyBible: JSON.stringify(book.storyBible),
    characters: book.characters.map(c => `${c.name}(${c.role}): ${c.personality}`).join('\n'),
    targetWords: String(book.targetWords || 300000),
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的小说大纲设计师，擅长构建有张力、有节奏、伏笔自然的长篇小说结构。你必须严格按照要求的 JSON 格式输出。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 8000,
    responseFormat: { type: 'json_object' },
  })

  const output = parseJsonResponse<OutlineOutput>(callResult.content)

  // 先删除旧章节（未写的）
  await prisma.chapter.deleteMany({ where: { bookId } })

  // 创建章节记录
  const chapters: Chapter[] = []
  for (const volume of output.volumes) {
    for (const ch of volume.chapters) {
      const chapter = await prisma.chapter.create({
        data: {
          bookId,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          chapterGoal: ch.goal,
          outline: [
            `关键事件: ${ch.keyEvents.join(', ')}`,
            `出场人物: ${ch.characters.join(', ')}`,
            `伏笔: ${ch.foreshadowing.join(', ')}`,
            `结尾钩子: ${ch.endingHook}`,
          ].join('\n'),
          status: 'unwritten',
        },
      })
      chapters.push(chapter)
    }
  }

  await prisma.generationRun.create({
    data: {
      bookId,
      taskType: 'outline',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { chapters }
}
