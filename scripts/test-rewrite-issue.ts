/**
 * 真实 AI 局部改写验收。
 *
 * 用法：
 *   npx tsx --require dotenv/config scripts/test-rewrite-issue.ts
 *
 * 可选环境变量：
 *   BOOK_ID=小说ID
 *   CHAPTER_NUMBER=章节号
 */

import { prisma } from '../lib/db'
import { analyzeChapterRepetition } from '../lib/ai/repetitionCheck'
import { rewriteIssue } from '../lib/ai/rewriteIssue'

const bookId = process.env.BOOK_ID || '772d4ca8-4245-4adb-b0e4-a6d9d38e7777'
const chapterNumber = Number(process.env.CHAPTER_NUMBER || '11')

function preview(text: string, length = 220): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length)
}

async function main() {
  const chapter = await prisma.chapter.findFirst({
    where: { bookId, chapterNumber },
    select: {
      id: true,
      chapterNumber: true,
      title: true,
      draftContent: true,
      finalContent: true,
    },
  })
  if (!chapter) throw new Error(`Chapter not found: bookId=${bookId}, chapterNumber=${chapterNumber}`)

  const content = chapter.draftContent || chapter.finalContent || ''
  if (!content) throw new Error('Chapter has no content')

  const previousChapters = await prisma.chapter.findMany({
    where: {
      bookId,
      chapterNumber: { lt: chapter.chapterNumber },
      OR: [
        { draftContent: { not: null } },
        { finalContent: { not: null } },
      ],
    },
    orderBy: { chapterNumber: 'desc' },
    take: 6,
    select: {
      chapterNumber: true,
      title: true,
      draftContent: true,
      finalContent: true,
    },
  })

  const before = analyzeChapterRepetition(
    {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content,
    },
    previousChapters.map((item) => ({
      chapterNumber: item.chapterNumber,
      title: item.title,
      content: item.finalContent || item.draftContent || '',
    }))
  )

  const issue = before.issues.find((item) => item.type === 'repetition') || before.issues[0]
  if (!issue) throw new Error('No repetition issue found for rewrite test')

  console.log(`章节：第 ${chapter.chapterNumber} 章《${chapter.title}》`)
  console.log(`改写前重复问题数：${before.issues.length}`)
  console.log(`选中问题：${issue.description}`)
  console.log(`位置：${preview(issue.location, 160)}`)

  const result = await rewriteIssue({
    bookId,
    chapterId: chapter.id,
    issue,
  })

  const after = analyzeChapterRepetition(
    {
      chapterNumber: result.chapter.chapterNumber,
      title: result.chapter.title,
      content: result.chapter.draftContent || '',
    },
    previousChapters.map((item) => ({
      chapterNumber: item.chapterNumber,
      title: item.title,
      content: item.finalContent || item.draftContent || '',
    }))
  )

  const lastRun = await prisma.generationRun.findFirst({
    where: { chapterId: chapter.id, taskType: 'rewrite_issue' },
    orderBy: { createdAt: 'desc' },
    select: {
      inputTokens: true,
      outputTokens: true,
      costEstimate: true,
      model: true,
    },
  })

  console.log('\n原片段：')
  console.log(preview(result.originalExcerpt, 260))
  console.log('\n改写片段：')
  console.log(preview(result.rewrittenExcerpt, 260))
  console.log('\n改写后重复问题数：' + after.issues.length)
  console.log(`模型：${lastRun?.model || 'unknown'}`)
  console.log(`tokens：${lastRun?.inputTokens || 0}+${lastRun?.outputTokens || 0}`)
  console.log(`成本估算：${(lastRun?.costEstimate || 0).toFixed(4)} 元`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
