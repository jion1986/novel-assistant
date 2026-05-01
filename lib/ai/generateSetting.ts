import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import type { StoryBible } from '@prisma/client'

export interface GenerateSettingInput {
  bookId: string
}

export interface GenerateSettingResult {
  storyBible: StoryBible
}

interface SettingOutput {
  worldSetting: string
  storyType: string
  tone: string
  coreConflict: string
  sellingPoints?: string
  powerSystem?: string
  rules?: string
  forbiddenChanges?: string
  styleGuide?: string
}

/**
 * 生成小说设定
 */
export async function generateSetting(input: GenerateSettingInput): Promise<GenerateSettingResult> {
  const { bookId } = input

  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) throw new Error(`Book not found: ${bookId}`)

  const template = await loadPromptTemplate('generate_setting.md')
  const prompt = fillTemplate(template, {
    coreIdea: book.coreIdea || book.title,
    genre: book.genre,
    targetWords: String(book.targetWords || 300000),
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的小说设定顾问，擅长根据一句话创意生成完整、一致、可扩展的小说世界观设定。你必须严格按照要求的 JSON 格式输出。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 4000,
    responseFormat: { type: 'json_object' },
  })

  const setting = parseJsonResponse<SettingOutput>(callResult.content)

  const storyBible = await prisma.storyBible.upsert({
    where: { bookId },
    create: {
      bookId,
      worldSetting: setting.worldSetting,
      storyType: setting.storyType,
      tone: setting.tone,
      coreConflict: setting.coreConflict,
      sellingPoints: setting.sellingPoints || '',
      powerSystem: setting.powerSystem || '',
      rules: setting.rules || '',
      forbiddenChanges: setting.forbiddenChanges || '',
      styleGuide: setting.styleGuide || '',
    },
    update: {
      worldSetting: setting.worldSetting,
      storyType: setting.storyType,
      tone: setting.tone,
      coreConflict: setting.coreConflict,
      sellingPoints: setting.sellingPoints || '',
      powerSystem: setting.powerSystem || '',
      rules: setting.rules || '',
      forbiddenChanges: setting.forbiddenChanges || '',
      styleGuide: setting.styleGuide || '',
    },
  })

  await prisma.generationRun.create({
    data: {
      bookId,
      taskType: 'setting',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { storyBible }
}
