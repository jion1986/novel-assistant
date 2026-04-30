import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import type { MemoryItem, Foreshadowing } from '@prisma/client'

export interface ExtractMemoryInput {
  bookId: string
  chapterId: string
}

export interface ExtractMemoryResult {
  memoryItems: MemoryItem[]
  foreshadowings: Foreshadowing[]
  nextChapterNotes: string
}

interface MemoryEvent {
  type: 'event'
  content: string
  importance: 'critical' | 'high' | 'normal' | 'low'
  relatedCharacters?: string[]
}

interface CharacterUpdate {
  name: string
  changes: string
}

interface NewCharacter {
  name: string
  role: string
  description: string
}

interface NewLocation {
  type: 'location'
  content: string
  importance: string
}

interface NewItem {
  type: 'item'
  content: string
  importance: string
}

interface RuleChange {
  type: 'rule'
  content: string
  importance: string
}

interface ForeshadowingUpdate {
  name: string
  status: 'planted' | 'developed' | 'resolved'
  note: string
}

interface NewForeshadowing {
  name: string
  description: string
  resolvePlan: string
}

interface ExtractMemoryOutput {
  events?: MemoryEvent[]
  characterUpdates?: CharacterUpdate[]
  newCharacters?: NewCharacter[]
  newLocations?: NewLocation[]
  newItems?: NewItem[]
  ruleChanges?: RuleChange[]
  foreshadowingUpdates?: ForeshadowingUpdate[]
  newForeshadowings?: NewForeshadowing[]
  nextChapterNotes?: string
}

/**
 * 基于定稿内容提取和更新记忆
 *
 * 核心规则：**只有 finalized 状态的章节才能触发**
 */
export async function extractMemory(input: ExtractMemoryInput): Promise<ExtractMemoryResult> {
  const { bookId, chapterId } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { book: { include: { storyBible: true } } },
  })
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  if (chapter.status !== 'finalized') throw new Error('Chapter must be finalized before extracting memory')
  if (!chapter.finalContent) throw new Error('Chapter has no final content')

  // 读取现有数据
  const existingMemory = await prisma.memoryItem.findMany({
    where: { bookId },
    orderBy: { createdAt: 'desc' },
  })
  const existingCharacters = await prisma.character.findMany({
    where: { bookId },
    orderBy: { orderIndex: 'asc' },
  })
  const existingForeshadowings = await prisma.foreshadowing.findMany({
    where: { bookId },
  })

  const template = await loadPromptTemplate('extract_memory.md')
  const prompt = fillTemplate(template, {
    finalContent: chapter.finalContent,
    existingMemory: existingMemory.map(m => `[${m.type}] ${m.content}`).join('\n') || '无',
    existingCharacters: existingCharacters.map(c => `${c.name}: ${c.currentStatus || '无状态'}`).join('\n') || '无',
    existingForeshadowings: existingForeshadowings.map(f => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无',
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的故事分析师，擅长从小说章节中提取关键信息并更新故事记忆库。你必须严格按照要求的 JSON 格式输出。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    maxTokens: 4000,
    responseFormat: { type: 'json_object' },
  })

  const output = parseJsonResponse<ExtractMemoryOutput>(callResult.content)

  const createdMemoryItems: MemoryItem[] = []
  const createdForeshadowings: Foreshadowing[] = []

  // 保存事件记忆
  for (const event of output.events || []) {
    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'event',
        content: event.content,
        relatedChapter: chapterId,
        importance: event.importance || 'normal',
      },
    })
    createdMemoryItems.push(item)
  }

  // 保存地点记忆
  for (const loc of output.newLocations || []) {
    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'location',
        content: loc.content,
        relatedChapter: chapterId,
        importance: (loc.importance as any) || 'normal',
      },
    })
    createdMemoryItems.push(item)
  }

  // 保存物品记忆
  for (const item of output.newItems || []) {
    const mem = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'item',
        content: item.content,
        relatedChapter: chapterId,
        importance: (item.importance as any) || 'normal',
      },
    })
    createdMemoryItems.push(mem)
  }

  // 保存规则变化
  for (const rule of output.ruleChanges || []) {
    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'rule',
        content: rule.content,
        relatedChapter: chapterId,
        importance: (rule.importance as any) || 'high',
      },
    })
    createdMemoryItems.push(item)
  }

  // 更新角色状态
  for (const update of output.characterUpdates || []) {
    const char = existingCharacters.find(c => c.name === update.name)
    if (char) {
      await prisma.character.update({
        where: { id: char.id },
        data: { currentStatus: update.changes },
      })
    }
  }

  // 更新伏笔状态
  for (const update of output.foreshadowingUpdates || []) {
    const fw = existingForeshadowings.find(f => f.name === update.name)
    if (fw) {
      await prisma.foreshadowing.update({
        where: { id: fw.id },
        data: {
          status: update.status as any,
          resolveChapter: update.status === 'resolved' ? chapter.chapterNumber.toString() : undefined,
        },
      })
    }
  }

  // 创建新伏笔
  for (const fw of output.newForeshadowings || []) {
    const f = await prisma.foreshadowing.create({
      data: {
        bookId,
        name: fw.name,
        description: fw.description,
        setupChapter: chapter.chapterNumber.toString(),
        status: 'planted',
        resolvePlan: fw.resolvePlan || '',
      },
    })
    createdForeshadowings.push(f)
  }

  // 更新章节摘要（如果 save-final 尚未生成高质量摘要，则用事件拼接作为兜底）
  const chapterAfterExtract = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { summary: true },
  })
  if (!chapterAfterExtract?.summary) {
    const allEvents = (output.events || []).map(e => e.content).join('; ')
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { summary: allEvents.slice(0, 500) || '暂无摘要' },
    })
  }

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'extract_memory',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return {
    memoryItems: createdMemoryItems,
    foreshadowings: createdForeshadowings,
    nextChapterNotes: output.nextChapterNotes || '',
  }
}
