import { callKimi, type KimiCallResult } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import { generateTempSummary } from './generateSummary'
import { formatMemoryItemsForContext, limitText } from './contextUtils'
import type { MemoryItem, Foreshadowing } from '@prisma/client'

type MemoryImportance = 'critical' | 'high' | 'normal' | 'low'
type ForeshadowingStatus = 'planted' | 'developed' | 'resolved'

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
  importance: MemoryImportance
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
  name?: string
  content: string
  importance: MemoryImportance
}

interface NewItem {
  type: 'item'
  name?: string
  content: string
  importance: MemoryImportance
}

interface RuleChange {
  type: 'rule'
  content: string
  importance: MemoryImportance
}

interface ForeshadowingUpdate {
  name: string
  status: ForeshadowingStatus
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

const EXTRACT_MEMORY_SYSTEM_PROMPT =
  '你是一个专业的故事分析师，擅长从小说章节中提取关键信息并更新故事记忆库。你必须严格按照要求的 JSON 格式输出。'

async function callExtractMemoryModel(prompt: string, retryReason?: string): Promise<KimiCallResult> {
  const retryInstruction = retryReason
    ? [
        '',
        '重要：上一次输出无法被 JSON.parse 解析。',
        `解析错误：${retryReason.slice(0, 240)}`,
        '请重新提取，并且只输出一个完整、合法、可解析的 JSON 对象。',
        '不要输出 Markdown，不要解释，不要省略字段名，不要使用省略号。',
        '每个数组最多保留 5 条最关键内容，确保输出完整闭合。',
      ].join('\n')
    : ''

  return callKimi({
    messages: [
      { role: 'system', content: EXTRACT_MEMORY_SYSTEM_PROMPT },
      { role: 'user', content: `${prompt}${retryInstruction}` },
    ],
    temperature: retryReason ? 0.2 : 0.5,
    maxTokens: retryReason ? 6000 : 4000,
    responseFormat: { type: 'json_object' },
  })
}

async function recordExtractMemoryRun(params: {
  bookId: string
  chapterId: string
  inputTokens: number
  outputTokens: number
  model: string
  result: 'success' | 'error' | 'fallback'
  errorMessage?: string
}) {
  await prisma.generationRun.create({
    data: {
      bookId: params.bookId,
      chapterId: params.chapterId,
      taskType: 'extract_memory',
      inputTokens: params.inputTokens || undefined,
      outputTokens: params.outputTokens || undefined,
      model: params.model || 'unknown',
      result: params.result,
      errorMessage: params.errorMessage?.slice(0, 1000),
      costEstimate: estimateCost(params.inputTokens, params.outputTokens),
    },
  })
}

function createFallbackMemoryOutput(chapter: { chapterNumber: number; title: string; finalContent: string }): ExtractMemoryOutput {
  return {
    events: [
      {
        type: 'event',
        content: `第${chapter.chapterNumber}章《${chapter.title}》定稿摘要：${generateTempSummary(chapter.finalContent)}`,
        importance: 'high',
      },
    ],
    nextChapterNotes: '记忆提取返回的 JSON 连续解析失败，已写入章节摘要型兜底记忆，建议人工复查。',
  }
}

function memoryImportance(value: unknown, fallback: MemoryImportance): MemoryImportance {
  return value === 'critical' || value === 'high' || value === 'normal' || value === 'low'
    ? value
    : fallback
}

function normalizeMemoryContent(content: string): string {
  return content
    .replace(/[\s"'“”‘’。、，；：:;,.!?！？《》【】（）()]/g, '')
    .toLowerCase()
}

function bigrams(value: string): Set<string> {
  const normalized = normalizeMemoryContent(value)
  const result = new Set<string>()
  for (let i = 0; i < normalized.length - 1; i++) {
    result.add(normalized.slice(i, i + 2))
  }
  return result
}

function memorySimilarity(a: string, b: string): number {
  const aBigrams = bigrams(a)
  const bBigrams = bigrams(b)
  if (aBigrams.size === 0 || bBigrams.size === 0) return 0

  let intersection = 0
  for (const gram of aBigrams) {
    if (bBigrams.has(gram)) intersection++
  }

  return (2 * intersection) / (aBigrams.size + bBigrams.size)
}

function isDuplicateMemory(content: string, existingContents: string[]): boolean {
  const normalized = normalizeMemoryContent(content)
  if (!normalized) return true

  return existingContents.some((existing) => {
    const normalizedExisting = normalizeMemoryContent(existing)
    return (
      normalizedExisting === normalized ||
      normalizedExisting.includes(normalized) ||
      normalized.includes(normalizedExisting) ||
      memorySimilarity(content, existing) >= 0.68
    )
  })
}

function namedContent(name: string | undefined, content: string): string {
  const cleanName = name?.trim()
  if (!cleanName) return content
  return content.includes(cleanName) ? content : `${cleanName}: ${content}`
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
  const existingMemoryContext = formatMemoryItemsForContext(existingMemory, {
    chapterTitle: chapter.title,
    chapterContent: chapter.finalContent,
    characters: existingCharacters,
    maxItems: 36,
    maxChars: 3200,
  })
  const prompt = fillTemplate(template, {
    finalContent: limitText(chapter.finalContent, 9000),
    existingMemory: existingMemoryContext,
    existingCharacters: existingCharacters
      .map((c) => [
        `${c.name}(${c.role})`,
        `当前状态: ${c.currentStatus || '无状态'}`,
        `身份: ${c.identity || '无'}`,
        `关系: ${c.relationships || '无'}`,
        `锁定事实: ${c.lockedFacts || '无'}`,
      ].join(' | '))
      .join('\n') || '无',
    existingForeshadowings: existingForeshadowings.map(f => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无',
    storyBible: limitText(JSON.stringify(chapter.book.storyBible), 2600),
  })

  let output: ExtractMemoryOutput
  let totalInputTokens = 0
  let totalOutputTokens = 0
  const attemptedModels: string[] = []
  let usedFallback = false

  try {
    const firstResult = await callExtractMemoryModel(prompt)
    totalInputTokens += firstResult.inputTokens
    totalOutputTokens += firstResult.outputTokens
    attemptedModels.push(firstResult.model)

    try {
      output = parseJsonResponse<ExtractMemoryOutput>(firstResult.content)
    } catch (parseError) {
      const retryResult = await callExtractMemoryModel(
        prompt,
        parseError instanceof Error ? parseError.message : String(parseError)
      )
      totalInputTokens += retryResult.inputTokens
      totalOutputTokens += retryResult.outputTokens
      attemptedModels.push(retryResult.model)
      output = parseJsonResponse<ExtractMemoryOutput>(retryResult.content)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await recordExtractMemoryRun({
      bookId,
      chapterId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: attemptedModels.join(' -> '),
      result: 'error',
      errorMessage,
    })
    output = createFallbackMemoryOutput({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      finalContent: chapter.finalContent,
    })
    usedFallback = true
  }

  const createdMemoryItems: MemoryItem[] = []
  const createdForeshadowings: Foreshadowing[] = []
  const memoryContents = existingMemory.map((m) => m.content)

  // 保存事件记忆
  for (const event of output.events || []) {
    if (isDuplicateMemory(event.content, memoryContents)) continue

    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'event',
        content: event.content,
        relatedChapter: chapterId,
        importance: memoryImportance(event.importance, 'normal'),
      },
    })
    createdMemoryItems.push(item)
    memoryContents.push(item.content)
  }

  // 保存地点记忆
  for (const loc of output.newLocations || []) {
    const content = namedContent(loc.name, loc.content)
    if (isDuplicateMemory(content, memoryContents)) continue

    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'location',
        content,
        relatedChapter: chapterId,
        importance: memoryImportance(loc.importance, 'normal'),
      },
    })
    createdMemoryItems.push(item)
    memoryContents.push(item.content)
  }

  // 保存物品记忆
  for (const item of output.newItems || []) {
    const content = namedContent(item.name, item.content)
    if (isDuplicateMemory(content, memoryContents)) continue

    const mem = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'item',
        content,
        relatedChapter: chapterId,
        importance: memoryImportance(item.importance, 'normal'),
      },
    })
    createdMemoryItems.push(mem)
    memoryContents.push(mem.content)
  }

  // 保存规则变化
  for (const rule of output.ruleChanges || []) {
    if (isDuplicateMemory(rule.content, memoryContents)) continue

    const item = await prisma.memoryItem.create({
      data: {
        bookId,
        type: 'rule',
        content: rule.content,
        relatedChapter: chapterId,
        importance: memoryImportance(rule.importance, 'high'),
      },
    })
    createdMemoryItems.push(item)
    memoryContents.push(item.content)
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
          status: update.status,
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

  await recordExtractMemoryRun({
    bookId,
    chapterId,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    model: attemptedModels.join(' -> '),
    result: usedFallback ? 'fallback' : 'success',
  })

  return {
    memoryItems: createdMemoryItems,
    foreshadowings: createdForeshadowings,
    nextChapterNotes: output.nextChapterNotes || '',
  }
}
