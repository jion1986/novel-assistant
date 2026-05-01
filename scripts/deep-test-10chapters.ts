/**
 * 10 章深度测试：验证长周期连续生成的稳定性
 *
 * 完整闭环 10 章：生成设定 → 生成人设 → 生成大纲 → 写正文 → 定稿 → 提取记忆。
 * 该脚本直接调用 lib/ai，避免受登录态、端口和 save-final 后台任务影响。
 *
 * 用法：npx --yes tsx scripts/deep-test-10chapters.ts
 * 预计耗时：15-30 分钟，取决于模型响应和续写次数。
 */

import { config } from 'dotenv'
config({ path: '.env', quiet: true })
config({ path: '.env.local', override: true, quiet: true })

import { prisma } from '../lib/db'
import { generateSetting } from '../lib/ai/generateSetting'
import { generateCharacters } from '../lib/ai/generateCharacters'
import { generateOutline } from '../lib/ai/generateOutline'
import { writeChapter } from '../lib/ai/writeChapter'
import { extractMemory } from '../lib/ai/extractMemory'

const CHAPTERS_TO_TEST = 10
const STEP_DELAY_MS = 3000
const RESUME_BOOK_ID = process.env.RESUME_BOOK_ID?.trim()

const TEST_BOOK = {
  title: `深度测试：星门计划_${new Date().toISOString().replace(/[:.]/g, '-')}`,
  genre: '科幻悬疑',
  coreIdea:
    '2045年，人类发现太阳系边缘的星门，探测队进入后发现门后是一个由古代文明建造的迷宫网络，每个门通向不同的时间线和现实分支。主角是一名量子物理学家，必须在各个分支中寻找回家的路，同时阻止一个试图控制星门的神秘组织。',
  targetWords: 500000,
  style: '硬科幻、悬疑紧张、多时间线叙事',
}

interface ChapterMetric {
  chapterId: string
  chapterNumber: number
  title: string
  wordCount: number
  inputTokens: number
  outputTokens: number
  cost: number
  memoryItemsAdded: number
  foreshadowingsAdded: number
  durationMs: number
  opening: string
}

interface TestChapter {
  id: string
  chapterNumber: number
  title: string
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${((ms % 60000) / 1000).toFixed(0)}s`
}

function compactText(value: string, length = 80): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, length)
}

function countWords(content: string): number {
  return content.replace(/\s/g, '').length
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hasExtractMemorySuccess(bookId: string, chapterId: string): Promise<boolean> {
  const run = await prisma.generationRun.findFirst({
    where: {
      bookId,
      chapterId,
      taskType: 'extract_memory',
      result: 'success',
    },
    select: { id: true },
  })
  return Boolean(run)
}

async function buildChapterMetric(bookId: string, chapterId: string, durationMs: number): Promise<ChapterMetric> {
  const [chapter, runs, memoryItemsAdded] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        draftContent: true,
        finalContent: true,
        wordCount: true,
      },
    }),
    prisma.generationRun.findMany({ where: { bookId, chapterId } }),
    prisma.memoryItem.count({ where: { bookId, relatedChapter: chapterId } }),
  ])

  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)

  const content = chapter.finalContent || chapter.draftContent || ''
  const chapterNumber = chapter.chapterNumber
  const actualForeshadowingsAdded = await prisma.foreshadowing.count({
    where: { bookId, setupChapter: chapterNumber.toString() },
  })

  return {
    chapterId: chapter.id,
    chapterNumber,
    title: chapter.title,
    wordCount: chapter.wordCount || countWords(content),
    inputTokens: runs.reduce((sum, run) => sum + (run.inputTokens || 0), 0),
    outputTokens: runs.reduce((sum, run) => sum + (run.outputTokens || 0), 0),
    cost: runs.reduce((sum, run) => sum + (run.costEstimate || 0), 0),
    memoryItemsAdded,
    foreshadowingsAdded: actualForeshadowingsAdded,
    durationMs,
    opening: compactText(content, 120),
  }
}

async function summarizeBook(bookId: string, metrics: ChapterMetric[], startedAt: number) {
  const [characters, memoryItems, foreshadowings, generationRuns] = await Promise.all([
    prisma.character.findMany({ where: { bookId }, orderBy: { orderIndex: 'asc' } }),
    prisma.memoryItem.findMany({ where: { bookId }, orderBy: { createdAt: 'asc' } }),
    prisma.foreshadowing.findMany({ where: { bookId }, orderBy: { createdAt: 'asc' } }),
    prisma.generationRun.findMany({ where: { bookId }, orderBy: { createdAt: 'asc' } }),
  ])

  const totalWords = metrics.reduce((sum, item) => sum + item.wordCount, 0)
  const totalInput = generationRuns.reduce((sum, run) => sum + (run.inputTokens || 0), 0)
  const totalOutput = generationRuns.reduce((sum, run) => sum + (run.outputTokens || 0), 0)
  const totalCost = generationRuns.reduce((sum, run) => sum + (run.costEstimate || 0), 0)

  const wordCounts = metrics.map((item) => item.wordCount)
  const avgWords = Math.round(totalWords / Math.max(1, metrics.length))
  const minWords = Math.min(...wordCounts)
  const maxWords = Math.max(...wordCounts)
  const variance =
    wordCounts.reduce((sum, count) => sum + Math.pow(count - avgWords, 2), 0) /
    Math.max(1, wordCounts.length)
  const stdDev = Math.round(Math.sqrt(variance))

  const memoryByType = memoryItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  const foreshadowingByStatus = foreshadowings.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})

  console.log('\n\n=== 10 章深度测试报告 ===\n')
  console.log('章节明细:')
  console.log('章 | 字数 | 输入T | 输出T | 成本(元) | 记忆+ | 伏笔+ | 耗时 | 标题')
  console.log('-'.repeat(110))
  for (const metric of metrics) {
    console.log(
      `${metric.chapterNumber.toString().padStart(2)} | ` +
        `${metric.wordCount.toString().padStart(5)} | ` +
        `${metric.inputTokens.toString().padStart(5)} | ` +
        `${metric.outputTokens.toString().padStart(5)} | ` +
        `${metric.cost.toFixed(4).padStart(8)} | ` +
        `${metric.memoryItemsAdded.toString().padStart(3)} | ` +
        `${metric.foreshadowingsAdded.toString().padStart(3)} | ` +
        `${formatTime(metric.durationMs).padStart(7)} | ` +
        metric.title
    )
  }

  console.log('-'.repeat(110))
  console.log(`总耗时: ${formatTime(Date.now() - startedAt)}`)
  console.log(`总调用: ${generationRuns.length} 次`)
  console.log(`总成本: ${totalCost.toFixed(4)} 元`)
  console.log(`总 tokens: ${totalInput.toLocaleString()} → ${totalOutput.toLocaleString()}`)
  console.log(`总字数: ${totalWords} (${(totalWords / 10000).toFixed(1)} 万字)`)
  console.log(`字数分布: 最小 ${minWords} | 最大 ${maxWords} | 平均 ${avgWords} | 标准差 ${stdDev}`)

  console.log('\n角色状态:')
  for (const character of characters) {
    console.log(`- ${character.name}(${character.role}): ${compactText(character.currentStatus || '无状态', 100)}`)
  }

  console.log('\n记忆库类型分布:')
  for (const [type, count] of Object.entries(memoryByType)) {
    console.log(`- ${type}: ${count} 条`)
  }

  console.log('\n伏笔状态分布:')
  for (const [status, count] of Object.entries(foreshadowingByStatus)) {
    console.log(`- ${status}: ${count} 条`)
  }

  console.log('\n章节开头抽样:')
  for (const metric of metrics) {
    console.log(`- 第${metric.chapterNumber}章: ${metric.opening}`)
  }

  const continuityScore = Math.min(
    100,
    Math.round(
      (characters.filter((item) => item.currentStatus).length / Math.max(1, characters.length)) * 30 +
        (memoryItems.length > 0 ? 30 : 0) +
        (foreshadowings.length > 0 ? 20 : 0) +
        (stdDev / Math.max(1, avgWords) < 0.3 ? 20 : 10)
    )
  )
  console.log(`\n连续性粗评分: ${continuityScore}/100`)

  return {
    totalWords,
    totalInput,
    totalOutput,
    totalCost,
    generationRuns: generationRuns.length,
    memoryItems: memoryItems.length,
    foreshadowings: foreshadowings.length,
    memoryByType,
    foreshadowingByStatus,
    continuityScore,
  }
}

async function main() {
  console.log('=== 10 章深度测试 ===')
  console.log(`测试章节数: ${CHAPTERS_TO_TEST}`)
  console.log(`测试题材: ${TEST_BOOK.genre}`)
  console.log(`测试项目: ${RESUME_BOOK_ID || TEST_BOOK.title}`)
  console.log(`运行模式: ${RESUME_BOOK_ID ? '恢复已有项目' : '新建测试项目'}`)
  console.log('')

  const startedAt = Date.now()
  let book: { id: string; title: string }
  let chapters: TestChapter[]

  if (RESUME_BOOK_ID) {
    const existingBook = await prisma.book.findUnique({
      where: { id: RESUME_BOOK_ID },
      select: { id: true, title: true },
    })
    if (!existingBook) throw new Error(`Book not found: ${RESUME_BOOK_ID}`)

    book = existingBook
    console.log('1. 恢复项目:', book.title)
    console.log('   Book ID:', book.id)

    chapters = await prisma.chapter.findMany({
      where: { bookId: book.id, chapterNumber: { lte: CHAPTERS_TO_TEST } },
      orderBy: { chapterNumber: 'asc' },
      select: { id: true, chapterNumber: true, title: true },
    })
    if (chapters.length < CHAPTERS_TO_TEST) {
      throw new Error(`已有项目仅有 ${chapters.length} 章，少于测试需要的 ${CHAPTERS_TO_TEST} 章`)
    }
    console.log(`2. 读取已有章节: ${chapters.length} 章`)
  } else {
    const user = await prisma.user.upsert({
      where: { username: 'test' },
      update: {},
      create: { username: 'test', password: 'test-hash' },
    })

    book = await prisma.book.create({
      data: { userId: user.id, ...TEST_BOOK },
    })
    console.log('1. 创建项目:', book.title)
    console.log('   Book ID:', book.id)

    const settingStarted = Date.now()
    const setting = await generateSetting({ bookId: book.id })
    console.log(`2. 生成设定: ${formatTime(Date.now() - settingStarted)}`)
    console.log(`   核心冲突: ${compactText(setting.storyBible.coreConflict, 100)}`)
    await sleep(STEP_DELAY_MS)

    const charactersStarted = Date.now()
    const characters = await generateCharacters({ bookId: book.id })
    console.log(`3. 生成人设: ${formatTime(Date.now() - charactersStarted)} (${characters.characters.length} 个角色)`)
    await sleep(STEP_DELAY_MS)

    const outlineStarted = Date.now()
    const outline = await generateOutline({ bookId: book.id })
    console.log(`4. 生成大纲: ${formatTime(Date.now() - outlineStarted)} (${outline.chapters.length} 章)`)

    if (outline.chapters.length < CHAPTERS_TO_TEST) {
      throw new Error(`大纲仅生成 ${outline.chapters.length} 章，少于测试需要的 ${CHAPTERS_TO_TEST} 章`)
    }

    chapters = outline.chapters.slice(0, CHAPTERS_TO_TEST).map((chapter) => ({
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
    }))
  }

  console.log('5. 选取前 10 章:')
  for (const chapter of chapters) {
    console.log(`   - 第${chapter.chapterNumber}章: ${chapter.title}`)
  }

  const metrics: ChapterMetric[] = []
  console.log('\n=== 开始连续写 10 章 ===')

  for (const chapter of chapters) {
    const chapterStarted = Date.now()
    console.log(`\n--- 第${chapter.chapterNumber}章: ${chapter.title} ---`)

    const currentChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
      select: {
        id: true,
        status: true,
        draftContent: true,
        finalContent: true,
        wordCount: true,
      },
    })
    if (!currentChapter) throw new Error(`Chapter not found: ${chapter.id}`)

    const memoryAlreadyExtracted = await hasExtractMemorySuccess(book.id, chapter.id)
    if (currentChapter.status === 'finalized' && currentChapter.finalContent && memoryAlreadyExtracted) {
      const metric = await buildChapterMetric(book.id, chapter.id, 0)
      metrics.push(metric)
      console.log(`已完成，跳过: ${metric.wordCount} 字, 记忆 ${metric.memoryItemsAdded} 条, 伏笔 ${metric.foreshadowingsAdded} 条`)
      continue
    }

    let content = currentChapter.finalContent || ''
    let wordCount = currentChapter.wordCount || countWords(content)

    if (currentChapter.status === 'finalized' && currentChapter.finalContent) {
      console.log(`正文已定稿，补提记忆: ${wordCount} 字`)
    } else {
      const writeResult = await writeChapter({
        bookId: book.id,
        chapterId: chapter.id,
      })
      content = writeResult.chapter.draftContent || ''
      wordCount = countWords(content)

      await prisma.chapter.update({
        where: { id: chapter.id },
        data: {
          draftContent: content,
          finalContent: content,
          status: 'finalized',
          wordCount,
        },
      })
    }

    if (!(await hasExtractMemorySuccess(book.id, chapter.id))) {
      await extractMemory({ bookId: book.id, chapterId: chapter.id })
    }

    const metric = await buildChapterMetric(book.id, chapter.id, Date.now() - chapterStarted)
    metrics.push(metric)

    console.log(`字数: ${metric.wordCount}`)
    console.log(`开头: ${metric.opening}`)
    console.log(`记忆: +${metric.memoryItemsAdded} 条, 伏笔: +${metric.foreshadowingsAdded} 条`)
    console.log(`本章成本: ${metric.cost.toFixed(4)} 元 (${metric.inputTokens}/${metric.outputTokens} tokens)`)
    console.log(`耗时: ${formatTime(metric.durationMs)}`)

    await sleep(STEP_DELAY_MS)
  }

  await summarizeBook(book.id, metrics, startedAt)
  console.log('\n=== 测试完成 ===')
}

main()
  .catch((error) => {
    console.error('\n测试失败:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
