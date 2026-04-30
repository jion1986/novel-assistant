/**
 * 单章快速测试：验证字数续写机制
 */

import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local', override: true })

import { prisma } from '../lib/db'
import { writeChapter } from '../lib/ai/writeChapter'

async function main() {
  // 找一个已有章节
  const chapter = await prisma.chapter.findFirst({
    where: { status: 'unwritten' },
    include: { book: true },
  })

  if (!chapter) {
    console.log('No unwritten chapter found')
    return
  }

  console.log(`Testing chapter: ${chapter.title}`)
  const start = Date.now()

  const result = await writeChapter({
    bookId: chapter.bookId,
    chapterId: chapter.id,
  })

  const content = result.chapter.draftContent || ''
  const wordCount = content.replace(/\s/g, '').length

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  console.log(`Word count: ${wordCount}`)
  console.log(`Preview: ${content.slice(0, 100)}...`)

  await prisma.$disconnect()
}

main().catch(console.error)
