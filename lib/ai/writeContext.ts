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

  // 构建章节衔接状态表（替代简单摘要，提供结构化上下文）
  const lastChapter = previousChapters[0]
  const lastChapterContent = lastChapter ? (lastChapter.finalContent || lastChapter.draftContent || '') : ''
  const lastLanding = lastChapterContent ? limitText(lastChapterContent.slice(-500), 500) : '无'

  const resolvedEvents = previousChapters
    .slice()
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((item) => `第${item.chapterNumber}章《${item.title}》：${limitText(item.summary || '无摘要', 200)}`)
    .join('\n')

  const recentConflictRecord = previousChapters
    .slice()
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((item) => `第${item.chapterNumber}章《${item.title}》：${limitText(item.summary || '无摘要', 160)}`)
    .join('\n')

  const chapterState = lastChapter
    ? `【章节衔接状态】\n\n上一章落点（本章必须从此场景和情绪状态继续，禁止跳转到全新场景重新开局）：\n${lastLanding}\n\n已解决事件（最近${previousChapters.length}章）：\n${resolvedEvents}\n\n未解决线索：\n${activeForeshadowings.length > 0 ? activeForeshadowings.map((item) => `• ${item.name}(${item.status})：${limitText(item.description, 120)}`).join('\n') : '• 无活跃伏笔'}\n\n最近${previousChapters.length}章冲突记录：\n${recentConflictRecord}\n\n本章硬性约束：\n• 不能重复最近3章已使用过的核心冲突类型（如第N章是"外部阻碍"，本章必须是其他类型）\n• 必须从"上一章落点"的场景和情绪状态继续，禁止像写新第一章那样重新开局\n• 主角不能做上一章已经做过的相同决定或采取相同行动\n• 必须推进至少一个"未解决线索"（呼应、升级或部分回收）\n• 必须带来新的信息增量，不能只是重复已知信息`
    : '【章节衔接状态】\n本章是第1章，无前文状态。必须快速进入核心场景，不要铺垫。'

  const prompt = fillTemplate(template, {
    storyBible: limitText(JSON.stringify(book.storyBible), 2600),
    characters: formatCharactersForContext(book.characters),
    chapterGoal: limitText(chapter.chapterGoal, 800),
    chapterPlan: limitText(chapter.outline, 1200),
    chapterState,
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
