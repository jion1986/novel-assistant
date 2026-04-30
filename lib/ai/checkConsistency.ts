import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'

export interface ConsistencyIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'character_drift' | 'setting_conflict' | 'timeline_error' | 'plot_hole' | 'foreshadowing_error' | 'repetition' | 'ai_tone'
  description: string
  location: string
  suggestion: string
}

export interface ConsistencyScore {
  overall: number
  characterConsistency: number
  settingConsistency: number
  timelineConsistency: number
  plotCoherence: number
  foreshadowingConsistency: number
  readability: number
}

export interface CheckConsistencyInput {
  bookId: string
  chapterId: string
}

export interface CheckConsistencyResult {
  issues: ConsistencyIssue[]
  score: ConsistencyScore
  summary: string
}

interface CheckOutput {
  issues?: Array<{
    severity: string
    type: string
    description: string
    location: string
    suggestion: string
  }>
  score?: {
    overall: number
    characterConsistency: number
    settingConsistency: number
    timelineConsistency: number
    plotCoherence: number
    foreshadowingConsistency: number
    readability: number
  }
  summary?: string
}

/**
 * 一致性检查
 */
export async function checkConsistency(input: CheckConsistencyInput): Promise<CheckConsistencyResult> {
  const { bookId, chapterId } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { book: { include: { storyBible: true } } },
  })
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  const contentToCheck = chapter.draftContent || chapter.finalContent || ''
  if (!contentToCheck) throw new Error('Chapter has no content to check')

  const characters = await prisma.character.findMany({
    where: { bookId },
    orderBy: { orderIndex: 'asc' },
  })
  const memoryItems = await prisma.memoryItem.findMany({
    where: { bookId, isActive: true },
  })
  const foreshadowings = await prisma.foreshadowing.findMany({
    where: { bookId },
  })

  // 构建时间线
  const finalizedChapters = await prisma.chapter.findMany({
    where: { bookId, status: 'finalized' },
    orderBy: { chapterNumber: 'asc' },
  })
  const timeline = finalizedChapters
    .map(c => `第${c.chapterNumber}章: ${c.summary || '无摘要'}`)
    .join('\n')

  const template = await loadPromptTemplate('check_consistency.md')
  const prompt = fillTemplate(template, {
    contentToCheck: contentToCheck.slice(0, 5000),
    storyBible: JSON.stringify(chapter.book.storyBible),
    characters: characters.map(c => `${c.name}(${c.role}): ${c.personality} [锁定设定: ${c.lockedFacts}]`).join('\n'),
    memoryItems: memoryItems.map(m => `[${m.type}] ${m.content}`).join('\n') || '无',
    foreshadowings: foreshadowings.map(f => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无',
    timeline: timeline || '无',
  })

  const callResult = await callKimi({
    messages: [
      { role: 'system', content: '你是一个专业的故事编辑，擅长发现小说中的设定冲突、人设漂移、剧情漏洞等问题。你必须严格按照要求的 JSON 格式输出。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 4000,
    responseFormat: { type: 'json_object' },
  })

  const output = parseJsonResponse<CheckOutput>(callResult.content)

  const issues: ConsistencyIssue[] = (output.issues || []).map(i => ({
    severity: (i.severity as any) || 'medium',
    type: (i.type as any) || 'plot_hole',
    description: i.description,
    location: i.location,
    suggestion: i.suggestion,
  }))

  const score: ConsistencyScore = output.score || {
    overall: 80,
    characterConsistency: 80,
    settingConsistency: 80,
    timelineConsistency: 80,
    plotCoherence: 80,
    foreshadowingConsistency: 80,
    readability: 80,
  }

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'check_consistency',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return {
    issues,
    score,
    summary: output.summary || '检查完成',
  }
}
