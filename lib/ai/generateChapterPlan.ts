import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import type { Chapter } from '@prisma/client'

export interface GenerateChapterPlanInput {
  bookId: string
}

export interface GenerateChapterPlanResult {
  chapters: Chapter[]
}

interface ChapterPlan {
  chapterNumber: number
  title: string
  goal: string
  characters: string[]
  conflict: string
  endingHook: string
  foreshadowing: {
    plant: string[]
    develop: string[]
    resolve: string[]
  }
  estimatedWords: number
  keyScenes: Array<{
    description: string
    purpose: string
  }>
}

interface ChapterPlanOutput {
  chapters: ChapterPlan[]
}

/**
 * 为所有未写章节生成详细的分章计划
 *
 * 读取现有 chapters（作为大纲输入），为每章生成详细计划后更新 outline 字段
 */
export async function generateChapterPlan(input: GenerateChapterPlanInput): Promise<GenerateChapterPlanResult> {
  const { bookId } = input

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
      foreshadowings: true,
    },
  })
  if (!book) throw new Error(`Book not found: ${bookId}`)

  // 只处理未写的章节
  const unwrittenChapters = book.chapters.filter((c) => c.status === 'unwritten')
  if (unwrittenChapters.length === 0) {
    throw new Error('没有未写章节，无法生成计划')
  }

  // 构建现有大纲文本
  const outlineText = book.chapters
    .map((c) => `第${c.chapterNumber}章《${c.title}》\n目标: ${c.chapterGoal || '待定'}\n大纲: ${c.outline || '待定'}`)
    .join('\n\n')

  const template = await loadPromptTemplate('generate_chapter_plan.md')
  const prompt = fillTemplate(template, {
    storyBible: JSON.stringify(book.storyBible),
    outline: outlineText,
    targetWords: String(book.targetWords || 300000),
  })

  const callResult = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是一个专业的小说大纲设计师，擅长将粗略的章节规划细化为可执行的写作蓝图。你必须严格按照要求的 JSON 格式输出。',
      },
      { role: 'user', content: prompt.slice(0, 12000) },
    ],
    temperature: 0.7,
    maxTokens: 8000,
    responseFormat: { type: 'json_object' },
  })

  const output = parseJsonResponse<ChapterPlanOutput>(callResult.content)

  // 更新每章的 outline 为更详细的计划
  const updatedChapters: Chapter[] = []
  for (const plan of output.chapters) {
    const existing = book.chapters.find((c) => c.chapterNumber === plan.chapterNumber)
    if (!existing) continue

    const detailedOutline = [
      `关键事件: ${plan.keyScenes.map((s) => s.description).join(', ')}`,
      `出场人物: ${plan.characters.join(', ')}`,
      `冲突: ${plan.conflict}`,
      `伏笔: ${[
        ...plan.foreshadowing.plant.map((f) => `埋伏: ${f}`),
        ...plan.foreshadowing.develop.map((f) => `发展: ${f}`),
        ...plan.foreshadowing.resolve.map((f) => `回收: ${f}`),
      ].join(', ')}`,
      `结尾钩子: ${plan.endingHook}`,
      `预估字数: ${plan.estimatedWords}`,
      '',
      '场景规划:',
      ...plan.keyScenes.map((s, i) => `${i + 1}. ${s.description}\n   作用: ${s.purpose}`),
    ].join('\n')

    const updated = await prisma.chapter.update({
      where: { id: existing.id },
      data: {
        chapterGoal: plan.goal,
        outline: detailedOutline,
      },
    })
    updatedChapters.push(updated)
  }

  await prisma.generationRun.create({
    data: {
      bookId,
      taskType: 'chapter_plan',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { chapters: updatedChapters }
}
