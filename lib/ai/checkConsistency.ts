import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { loadPromptTemplate, fillTemplate, parseJsonResponse, estimateCost } from './utils'
import { analyzeChapterRepetition } from './repetitionCheck'
import { formatCharactersForContext, formatMemoryItemsForContext, limitText } from './contextUtils'

export interface ConsistencyIssue {
  severity: ConsistencySeverity
  type: ConsistencyIssueType
  description: string
  location: string
  suggestion: string
}

type ConsistencySeverity = 'critical' | 'high' | 'medium' | 'low'
type ConsistencyIssueType =
  | 'character_drift'
  | 'setting_conflict'
  | 'timeline_error'
  | 'plot_hole'
  | 'foreshadowing_error'
  | 'repetition'
  | 'ai_tone'

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

function consistencySeverity(value: string): ConsistencySeverity {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'medium'
}

function consistencyIssueType(value: string): ConsistencyIssueType {
  const types: ConsistencyIssueType[] = [
    'character_drift',
    'setting_conflict',
    'timeline_error',
    'plot_hole',
    'foreshadowing_error',
    'repetition',
    'ai_tone',
  ]
  return types.includes(value as ConsistencyIssueType) ? value as ConsistencyIssueType : 'plot_hole'
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
    .map(c => `第${c.chapterNumber}章: ${limitText(c.summary || '无摘要', 220)}`)
    .join('\n')
  const localRepetitionIssues = analyzeChapterRepetition(
    {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content: contentToCheck,
    },
    finalizedChapters
      .filter((item) => item.id !== chapterId)
      .map((item) => ({
        chapterNumber: item.chapterNumber,
        title: item.title,
        content: item.finalContent || item.draftContent || '',
      }))
  ).issues

  const template = await loadPromptTemplate('check_consistency.md')
  const prompt = fillTemplate(template, {
    contentToCheck: limitText(contentToCheck, 4200),
    storyBible: limitText(JSON.stringify(chapter.book.storyBible), 1800),
    characters: formatCharactersForContext(characters, 2200),
    memoryItems: formatMemoryItemsForContext(memoryItems, {
      chapterTitle: chapter.title,
      chapterContent: contentToCheck,
      characters,
      maxItems: 28,
      maxChars: 2200,
    }),
    foreshadowings: limitText(foreshadowings.map(f => `${f.name}(${f.status}): ${f.description}`).join('\n') || '无', 1200),
    timeline: limitText(timeline || '无', 1800),
  })

  let output: CheckOutput = {
    issues: [],
    score: {
      overall: localRepetitionIssues.length > 0 ? 76 : 88,
      characterConsistency: 82,
      settingConsistency: 82,
      timelineConsistency: 82,
      plotCoherence: 82,
      foreshadowingConsistency: 82,
      readability: localRepetitionIssues.length > 0 ? 72 : 88,
    },
    summary: 'AI 一致性检查未完成，已返回本地重复检查结果。',
  }
  let callResult: Awaited<ReturnType<typeof callKimi>> | null = null
  let aiCheckSucceeded = false

  try {
    callResult = await callKimi({
      messages: [
        { role: 'system', content: '你是一个专业的故事编辑，擅长发现小说中的设定冲突、人设漂移、剧情漏洞等问题。你必须严格按照要求的 JSON 格式输出。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 2500,
      responseFormat: { type: 'json_object' },
    })
    output = parseJsonResponse<CheckOutput>(callResult.content)
    aiCheckSucceeded = true
  } catch (error) {
    await prisma.generationRun.create({
      data: {
        bookId,
        chapterId,
        taskType: 'check_consistency',
        inputTokens: callResult?.inputTokens,
        outputTokens: callResult?.outputTokens,
        model: callResult?.model || 'unknown',
        result: 'error',
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
        costEstimate: callResult ? estimateCost(callResult.inputTokens, callResult.outputTokens) : undefined,
      },
    })
  }

  const aiIssues: ConsistencyIssue[] = (output.issues || []).map(i => ({
    severity: consistencySeverity(i.severity),
    type: consistencyIssueType(i.type),
    description: i.description,
    location: i.location,
    suggestion: i.suggestion,
  }))
  const issues = [...localRepetitionIssues, ...aiIssues]

  const score: ConsistencyScore = output.score || {
    overall: 80,
    characterConsistency: 80,
    settingConsistency: 80,
    timelineConsistency: 80,
    plotCoherence: 80,
    foreshadowingConsistency: 80,
    readability: 80,
  }
  if (localRepetitionIssues.length > 0) {
    const penalty = Math.min(12, localRepetitionIssues.length * 4)
    score.overall = Math.max(0, score.overall - penalty)
    score.readability = Math.max(0, score.readability - penalty)
  }

  if (aiCheckSucceeded && callResult) {
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
  }

  return {
    issues,
    score,
    summary: localRepetitionIssues.length > 0
      ? `本地重复检查发现 ${localRepetitionIssues.length} 个重复风险。${output.summary || '检查完成'}`
      : output.summary || '检查完成',
  }
}
