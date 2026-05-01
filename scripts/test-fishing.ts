/**
 * 钓鱼文测试：休闲风格
 */

import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local', override: true })

import { prisma } from '../lib/db'
import { generateSetting } from '../lib/ai/generateSetting'
import { generateCharacters } from '../lib/ai/generateCharacters'
import { generateOutline } from '../lib/ai/generateOutline'
import { writeChapter } from '../lib/ai/writeChapter'

const TEST_BOOK = {
  title: '悠闲钓手',
  genre: '钓鱼文',
  coreIdea: '城市白领辞职回到乡下爷爷的钓棚，本想安安静静钓鱼养老，却发现这片水域不简单——钓上来的鱼能带来各种神奇效果，而水底似乎藏着更大的秘密',
  targetWords: 300000,
  style: '轻松解压、休闲治愈、期待感强',
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('=== 钓鱼文测试 ===\n')

  const user = await prisma.user.upsert({
    where: { username: 'test' },
    update: {},
    create: { username: 'test', password: 'test-hash' },
  })

  const book = await prisma.book.create({
    data: { userId: user.id, ...TEST_BOOK },
  })
  console.log('创建项目:', book.title)

  // 生成设定
  console.log('\n--- 生成设定 ---')
  const setting = await generateSetting({ bookId: book.id })
  console.log('世界观:', setting.storyBible.worldSetting)
  console.log('核心冲突:', setting.storyBible.coreConflict)
  console.log('力量体系:', setting.storyBible.powerSystem)
  await sleep(3000)

  // 生成人设
  console.log('\n--- 生成人设 ---')
  const chars = await generateCharacters({ bookId: book.id })
  for (const c of chars.characters) {
    console.log(`${c.name} (${c.role}): ${c.personality}`)
  }
  await sleep(3000)

  // 生成大纲
  console.log('\n--- 生成大纲 ---')
  const outline = await generateOutline({ bookId: book.id })
  console.log(`共 ${outline.chapters.length} 章`)
  for (const ch of outline.chapters.slice(0, 5)) {
    console.log(`  第${ch.chapterNumber}章: ${ch.title}`)
  }
  await sleep(3000)

  // 写前3章
  console.log('\n=== 开始写前3章 ===')
  for (let i = 0; i < 3; i++) {
    const ch = outline.chapters[i]
    console.log(`\n--- 第${ch.chapterNumber}章: ${ch.title} ---`)
    const start = Date.now()

    const result = await writeChapter({ bookId: book.id, chapterId: ch.id })
    const content = result.chapter.draftContent || ''
    const wordCount = content.replace(/\s/g, '').length

    console.log(`字数: ${wordCount}`)
    console.log(`耗时: ${((Date.now() - start) / 1000).toFixed(1)}s`)
    console.log(`\n开头:\n${content.slice(0, 300)}...\n`)

    // 保存定稿
    await prisma.chapter.update({
      where: { id: ch.id },
      data: {
        finalContent: content,
        draftContent: content,
        status: 'finalized',
        wordCount,
      },
    })

    if (i < 2) await sleep(3000)
  }

  // 统计
  const runs = await prisma.generationRun.findMany({ where: { bookId: book.id } })
  const totalCost = runs.reduce((s, r) => s + (r.costEstimate || 0), 0)
  console.log('\n=== 完成 ===')
  console.log(`总调用: ${runs.length} 次`)
  console.log(`总成本: ${totalCost.toFixed(4)} 元`)

  await prisma.$disconnect()
}

main().catch(console.error)
