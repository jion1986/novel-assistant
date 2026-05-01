import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import type { Character } from '@prisma/client'

export interface GenerateCharactersInput {
  bookId: string
}

export interface GenerateCharactersResult {
  characters: Character[]
}

interface CharacterOutput {
  name: string
  role: 'protagonist' | 'deuteragonist' | 'supporting' | 'antagonist'
  age?: string
  identity?: string
  personality?: string
  goal?: string
  speakingStyle?: string
  currentStatus?: string
  relationships?: string
  lockedFacts?: string[]
}

interface CharactersOutput {
  characters: CharacterOutput[]
}

/**
 * 生成角色列表
 */
export async function generateCharacters(input: GenerateCharactersInput): Promise<GenerateCharactersResult> {
  const { bookId } = input

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { storyBible: true },
  })
  if (!book) throw new Error(`Book not found: ${bookId}`)

  const template = await loadPromptTemplate('generate_characters.md')
  const prompt = fillTemplate(template, {
    storyBible: book.storyBible?.worldSetting || '',
    coreIdea: book.coreIdea || book.title,
    genre: book.genre,
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的小说角色设计师，擅长根据世界观设定创造鲜活、有冲突、有成长空间的角色群像。你必须严格按照要求的 JSON 格式输出。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 4000,
    responseFormat: { type: 'json_object' },
  })

  const output = parseJsonResponse<CharactersOutput>(callResult.content)

  // 先删除旧角色
  await prisma.character.deleteMany({ where: { bookId } })

  // 创建新角色
  const characters: Character[] = []
  for (let i = 0; i < output.characters.length; i++) {
    const c = output.characters[i]
    const char = await prisma.character.create({
      data: {
        bookId,
        name: c.name,
        role: c.role,
        age: c.age || '',
        identity: c.identity || '',
        personality: c.personality || '',
        goal: c.goal || '',
        speakingStyle: c.speakingStyle || '',
        currentStatus: c.currentStatus || '',
        relationships: c.relationships || '',
        lockedFacts: JSON.stringify(c.lockedFacts || []),
        orderIndex: i,
      },
    })
    characters.push(char)
  }

  await prisma.generationRun.create({
    data: {
      bookId,
      taskType: 'characters',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return { characters }
}
