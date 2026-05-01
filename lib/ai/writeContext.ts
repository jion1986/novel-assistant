import { prisma } from '../db'
import { fillTemplate, loadPromptTemplate } from './utils'
import {
  HARD_MAX_CHAPTER_WORDS,
  MIN_CHAPTER_WORDS,
  SOFT_MAX_CHAPTER_WORDS,
  TARGET_CHAPTER_WORDS,
  estimatePromptTokens,
  formatCharactersForContext,
  formatMemoryItemsForContext,
  limitText,
} from './contextUtils'
import { buildOpeningAvoidanceNote } from './repetitionCheck'
import type { Book, Chapter, Character, StoryBible } from '@prisma/client'

type BookWithContext = Book & {
  storyBible: StoryBible | null
  characters: Character[]
  chapters: Chapter[]
}

export interface WriteChapterContext {
  book: BookWithContext
  chapter: Chapter
  prompt: string
  estimatedInputTokens: number
}

export async function buildWriteChapterContext(input: {
  bookId: string
  chapterId: string
  userId?: string
}): Promise<WriteChapterContext> {
  const book = await prisma.book.findFirst({
    where: { id: input.bookId, ...(input.userId ? { userId: input.userId } : {}) },
    include: {
      storyBible: true,
      characters: { orderBy: { orderIndex: 'asc' } },
      chapters: { orderBy: { chapterNumber: 'asc' } },
    },
  })
  if (!book) throw new Error(`Book not found: ${input.bookId}`)

  const chapter = book.chapters.find((item) => item.id === input.chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${input.chapterId}`)

  const previousChapters = book.chapters
    .filter((item) => item.chapterNumber < chapter.chapterNumber && item.status === 'finalized')
    .sort((a, b) => b.chapterNumber - a.chapterNumber)
    .slice(0, 3)

  const previousSummaries = previousChapters
    .map((item) => `第${item.chapterNumber}章《${item.title}》: ${limitText(item.summary || '无摘要', 360)}`)
    .join('\n')

  const recentOpenings = previousChapters
    .slice()
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((item) => {
      const content = item.finalContent || item.draftContent || ''
      return `第${item.chapterNumber}章《${item.title}》开头: ${limitText(content, 140) || '无'}`
    })
    .join('\n')

  const openingAvoidance = buildOpeningAvoidanceNote(
    previousChapters
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((item) => ({
        chapterNumber: item.chapterNumber,
        title: item.title,
        content: item.finalContent || item.draftContent || '',
      }))
  )

  const [activeForeshadowings, memoryItems, template] = await Promise.all([
    prisma.foreshadowing.findMany({
      where: { bookId: input.bookId, status: { in: ['planted', 'developed'] } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.memoryItem.findMany({
      where: { bookId: input.bookId, isActive: true },
      orderBy: [{ isLocked: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    }),
    loadPromptTemplate('write_chapter.md'),
  ])

  const memorySummary = formatMemoryItemsForContext(memoryItems, {
    chapterTitle: chapter.title,
    chapterGoal: chapter.chapterGoal,
    chapterPlan: chapter.outline,
    characters: book.characters,
    recentChapterIds: previousChapters.map((item) => item.id),
    maxItems: 24,
    maxChars: 2400,
  })

  const activeForeshadowingText = activeForeshadowings
    .map((item) => `${item.name}(${item.status}): ${limitText(item.description, 180)}`)
    .join('\n')

  const prompt = fillTemplate(template, {
    storyBible: limitText(JSON.stringify(book.storyBible), 2600),
    characters: formatCharactersForContext(book.characters),
    chapterGoal: limitText(chapter.chapterGoal, 800),
    chapterPlan: limitText(chapter.outline, 1200),
    previousSummaries: previousSummaries || '无前文',
    recentOpenings: recentOpenings || '无',
    openingAvoidance,
    activeForeshadowings: limitText(activeForeshadowingText, 1200) || '无活跃伏笔',
    memorySummary,
    styleGuide: limitText(book.storyBible?.styleGuide || book.style || '', 900),
    targetWords: String(TARGET_CHAPTER_WORDS),
    targetWordRange: `${MIN_CHAPTER_WORDS}-${SOFT_MAX_CHAPTER_WORDS}`,
    hardMaxWords: String(HARD_MAX_CHAPTER_WORDS),
  })

  return {
    book,
    chapter,
    prompt,
    estimatedInputTokens: estimatePromptTokens(prompt),
  }
}
