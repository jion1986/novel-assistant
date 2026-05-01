import { callKimi } from './kimiClient'
import { prisma } from '../db'
import { estimateCost } from './utils'
import { countContentWords, limitText } from './contextUtils'
import type { Chapter } from '@prisma/client'
import type { ConsistencyIssue } from './checkConsistency'
import type { Character } from '@prisma/client'

export interface RewriteIssueInput {
  bookId: string
  chapterId: string
  issue: ConsistencyIssue
}

export interface RewriteIssueResult {
  chapter: Chapter
  originalExcerpt: string
  rewrittenExcerpt: string
}

interface TextSegment {
  start: number
  end: number
  text: string
}

function normalizeWithMap(content: string): { normalized: string; map: number[] } {
  let normalized = ''
  const map: number[] = []

  for (let index = 0; index < content.length; index++) {
    const char = content[index]
    if (/[\s"'“”‘’。、，；：:;,.!?！？《》【】（）()]/.test(char)) continue
    normalized += char.toLowerCase()
    map.push(index)
  }

  return { normalized, map }
}

function extendToSentenceBoundary(content: string, start: number, end: number): TextSegment {
  const before = content.slice(0, start)
  const after = content.slice(end)
  const left = Math.max(
    before.lastIndexOf('\n\n'),
    before.lastIndexOf('。'),
    before.lastIndexOf('！'),
    before.lastIndexOf('？'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?')
  )
  const rightSearch = after.search(/[。！？!?]\s*/)
  const segmentStart = left >= 0 ? left + 1 : start
  const segmentEnd = rightSearch >= 0 ? end + rightSearch + 1 : end

  return {
    start: Math.max(0, segmentStart),
    end: Math.min(content.length, segmentEnd),
    text: content.slice(Math.max(0, segmentStart), Math.min(content.length, segmentEnd)).trim(),
  }
}

function findByNormalizedQuery(content: string, query: string): TextSegment | null {
  const cleanQuery = normalizeWithMap(query).normalized
  if (cleanQuery.length < 8) return null

  const { normalized, map } = normalizeWithMap(content)
  const probes = [
    cleanQuery,
    cleanQuery.slice(0, 180),
    cleanQuery.slice(0, 120),
    cleanQuery.slice(0, 80),
  ].filter((item) => item.length >= 8)

  for (const probe of probes) {
    const normalizedStart = normalized.indexOf(probe)
    if (normalizedStart < 0) continue

    const normalizedEnd = normalizedStart + probe.length - 1
    const start = map[normalizedStart]
    const end = map[normalizedEnd] + 1
    return extendToSentenceBoundary(content, start, end)
  }

  return null
}

function trigrams(value: string): Set<string> {
  const normalized = normalizeWithMap(value).normalized
  const grams = new Set<string>()
  for (let index = 0; index < normalized.length - 2; index++) {
    grams.add(normalized.slice(index, index + 3))
  }
  return grams
}

function similarity(a: string, b: string): number {
  const aGrams = trigrams(a)
  const bGrams = trigrams(b)
  if (!aGrams.size || !bGrams.size) return 0

  let intersection = 0
  for (const gram of aGrams) {
    if (bGrams.has(gram)) intersection++
  }

  return (2 * intersection) / (aGrams.size + bGrams.size)
}

function findByParagraphSimilarity(content: string, query: string): TextSegment | null {
  const paragraphs: TextSegment[] = []
  const matches = content.matchAll(/[^\n]+/g)
  for (const match of matches) {
    const text = match[0].trim()
    if (!text) continue
    const start = match.index || 0
    paragraphs.push({ start, end: start + match[0].length, text })
  }

  const best = paragraphs
    .map((segment) => ({ segment, score: similarity(segment.text, query) }))
    .sort((a, b) => b.score - a.score)[0]

  if (!best || best.score < 0.08) return null
  return extendToSentenceBoundary(content, best.segment.start, best.segment.end)
}

export function findIssueSegment(content: string, issue: Pick<ConsistencyIssue, 'location' | 'type'>): TextSegment {
  const location = issue.location?.trim() || ''
  const byNormalized = location ? findByNormalizedQuery(content, location) : null
  if (byNormalized) return byNormalized

  const byParagraph = location ? findByParagraphSimilarity(content, location) : null
  if (byParagraph) return byParagraph

  if (issue.type === 'repetition') {
    const openingEnd = Math.min(content.length, 700)
    return extendToSentenceBoundary(content, 0, openingEnd)
  }

  return {
    start: 0,
    end: Math.min(content.length, 900),
    text: content.slice(0, Math.min(content.length, 900)).trim(),
  }
}

function findPreservedCharacterNames(segmentText: string, characters: Character[]): string[] {
  return characters
    .map((character) => character.name)
    .filter((name) => name && segmentText.includes(name))
}

function extractAvoidTerms(issue: ConsistencyIssue): string[] {
  const source = `${issue.description} ${issue.location}`
  const match = source.match(/重复意象包括[：:]\s*([^。；;\n]+)/)
  if (!match) return []

  return match[1]
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 8)
}

export async function rewriteIssue(input: RewriteIssueInput): Promise<RewriteIssueResult> {
  const { bookId, chapterId, issue } = input

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      book: {
        include: {
          storyBible: true,
          characters: { orderBy: { orderIndex: 'asc' } },
        },
      },
    },
  })
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  const content = chapter.draftContent || chapter.finalContent || ''
  if (!content) throw new Error('Chapter has no content to rewrite')

  const segment = findIssueSegment(content, issue)
  if (!segment.text) throw new Error('Could not locate issue segment')

  const characters = chapter.book.characters
    .map((c) => `${c.name}(${c.role}): ${c.currentStatus || c.personality || ''} [锁定设定: ${c.lockedFacts || '无'}]`)
    .join('\n')
  const preservedNames = findPreservedCharacterNames(segment.text, chapter.book.characters)
  const avoidTerms = extractAvoidTerms(issue)

  let callResult = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是小说编辑。你只改写给定片段，修复指定问题，保持剧情事实、人物关系和语气连续。只输出改写后的片段，不要解释。',
      },
      {
        role: 'user',
        content: [
          `问题类型：${issue.type}`,
          `严重程度：${issue.severity}`,
          `问题描述：${issue.description}`,
          `修改建议：${issue.suggestion}`,
          '',
          `小说圣经：${limitText(JSON.stringify(chapter.book.storyBible), 1400)}`,
          `角色约束：${limitText(characters, 1600)}`,
          preservedNames.length ? `必须保留这些已出场人物，不能替换或遗漏：${preservedNames.join('、')}` : '',
          avoidTerms.length ? `重复问题必须明显避开或减少这些意象和表达：${avoidTerms.join('、')}` : '',
          '',
          '需要改写的片段：',
          segment.text,
          '',
          '要求：',
          '- 只输出改写后的片段',
          '- 不要新增与设定冲突的事实',
          '- 不要改变本章核心事件',
          '- 不要替换片段中已经出现的人物',
          '- 如果问题是重复开头，必须换一个新的冲突入口或人物动作，不要继续用控制台、屏幕、数据流、能量场波动作为开场核心',
          '- 改写后长度与原片段接近',
        ].filter(Boolean).join('\n'),
      },
    ],
    temperature: 0.45,
    maxTokens: Math.min(2200, Math.max(700, Math.ceil(segment.text.length * 1.4))),
  })

  let rewrittenExcerpt = callResult.content.trim()
  if (!rewrittenExcerpt) throw new Error('Rewrite returned empty content')
  const missingNames = preservedNames.filter((name) => !rewrittenExcerpt.includes(name))
  if (missingNames.length > 0) {
    callResult = await callKimi({
      messages: [
        {
          role: 'system',
          content: '你是小说编辑。上一次改写遗漏或替换了人物。现在必须修正：只输出改写后的片段，保留指定人物。',
        },
        {
          role: 'user',
          content: [
            `必须保留人物：${preservedNames.join('、')}`,
            avoidTerms.length ? `重复问题必须明显避开或减少这些意象和表达：${avoidTerms.join('、')}` : '',
            `问题描述：${issue.description}`,
            `修改建议：${issue.suggestion}`,
            '',
            '原片段：',
            segment.text,
            '',
            '重新改写，要求：',
            '- 不要替换、遗漏或新增主要出场人物',
            '- 保持核心事件不变',
            '- 修复指定问题',
            '- 只输出改写后的片段',
          ].filter(Boolean).join('\n'),
        },
      ],
      temperature: 0.35,
      maxTokens: Math.min(2200, Math.max(700, Math.ceil(segment.text.length * 1.4))),
    })
    rewrittenExcerpt = callResult.content.trim()
    const retryMissingNames = preservedNames.filter((name) => !rewrittenExcerpt.includes(name))
    if (retryMissingNames.length > 0) {
      throw new Error(`Rewrite omitted preserved character names: ${retryMissingNames.join(', ')}`)
    }
  }

  const updatedContent = `${content.slice(0, segment.start)}${rewrittenExcerpt}${content.slice(segment.end)}`

  const updatedChapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      draftContent: updatedContent,
      status: 'ai_draft',
      wordCount: countContentWords(updatedContent),
    },
  })

  await prisma.chapterVersion.create({
    data: {
      chapterId,
      versionType: 'ai_draft',
      content: updatedContent,
      note: `按检查问题改写: ${issue.description.slice(0, 80)}`,
    },
  })

  await prisma.generationRun.create({
    data: {
      bookId,
      chapterId,
      taskType: 'rewrite_issue',
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      model: callResult.model,
      result: 'success',
      costEstimate: estimateCost(callResult.inputTokens, callResult.outputTokens),
    },
  })

  return {
    chapter: updatedChapter,
    originalExcerpt: segment.text,
    rewrittenExcerpt,
  }
}
