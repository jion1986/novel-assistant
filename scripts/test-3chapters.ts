/**
 * 3章快速端到端测试
 * 验证完整链路：设定 → 人设 → 大纲 → 分章 → 写3章 → 定稿 → 提取记忆
 */

import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local', override: true })

import { prisma } from '../lib/db'
import { generateSetting } from '../lib/ai/generateSetting'
import { generateCharacters } from '../lib/ai/generateCharacters'
import { generateOutline } from '../lib/ai/generateOutline'
import { writeChapter } from '../lib/ai/writeChapter'
import { extractMemory } from '../lib/ai/extractMemory'

const TEST_BOOK = {
  title: '3章测试：暗影商人',
  genre: '悬疑推理',
  coreIdea: '一个专门帮黑帮洗钱的会计师，在一次例行审计中发现自己的客户竟然在策划一场针对市政府的恐怖袭击，他必须在48小时内找出证据并阻止袭击，同时还要应付黑帮的追杀和警方的怀疑',
  targetWords: 300000,
  style: '快节奏、悬疑紧张、多线叙事',
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${((ms % 60000) / 1000).toFixed(0)}s`
}

async function main() {
  console.log('=== 3章端到端测试 ===\n')
  const overallStart = Date.now()

  // 0. 准备测试用户
  const user = await prisma.user.upsert({
    where: { username: 'test' },
    update: {},
    create: { username: 'test', password: 'test-hash' },
  })

  // 1. 创建小说
  const book = await prisma.book.create({
    data: { userId: user.id, ...TEST_BOOK },
  })
  console.log('1. 创建项目:', book.title)

  // 2. 生成设定
  const step2Start = Date.now()
  const settingResult = await generateSetting({ bookId: book.id })
  console.log(`2. 生成设定: ${formatTime(Date.now() - step2Start)}`)
  console.log(`   世界观: ${settingResult.storyBible.worldSetting.slice(0, 60)}...`)
  console.log(`   核心冲突: ${settingResult.storyBible.coreConflict}`)
  await sleep(2000)

  // 3. 生成人设
  const step3Start = Date.now()
  const charsResult = await generateCharacters({ bookId: book.id })
  console.log(`3. 生成人设: ${formatTime(Date.now() - step3Start)}`)
  console.log(`   角色数: ${charsResult.characters.length}`)
  for (const c of charsResult.characters.slice(0, 3)) {
    console.log(`   - ${c.name} (${c.role}): ${c.personality?.slice(0, 50)}...`)
  }
  await sleep(2000)

  // 4. 生成大纲（会自动创建Chapter记录）
  const step4Start = Date.now()
  const outlineResult = await generateOutline({ bookId: book.id })
  console.log(`4. 生成大纲: ${formatTime(Date.now() - step4Start)}`)
  console.log(`   总章数: ${outlineResult.chapters.length}`)
  await sleep(2000)

  // 5. 取前3章
  const dbChapters = outlineResult.chapters.slice(0, 3)
  console.log(`5. 选取章节: ${dbChapters.length} 章`)
  for (const ch of dbChapters) {
    console.log(`   - 第${ch.chapterNumber}章: ${ch.title}`)
  }

  // 6. 连续写3章
  console.log('\n=== 开始写3章正文 ===')
  for (let i = 0; i < 3; i++) {
    const ch = dbChapters[i]
    const chStart = Date.now()
    console.log(`\n--- 第${i + 1}章: ${ch.title} ---`)

    try {
      const writeResult = await writeChapter({
        bookId: book.id,
        chapterId: ch.id,
      })
      const content = writeResult.chapter.draftContent || ''
      console.log(`   字数: ${content.length}`)
      console.log(`   开头: ${content.slice(0, 60).replace(/\n/g, ' ')}...`)
      console.log(`   耗时: ${formatTime(Date.now() - chStart)}`)

      // 保存定稿
      await prisma.chapter.update({
        where: { id: ch.id },
        data: {
          finalContent: content,
          draftContent: content,
          status: 'finalized',
          wordCount: content.length,
        },
      })
      console.log('   定稿已保存')

      // 提取记忆
      const memStart = Date.now()
      const beforeMem = await prisma.memoryItem.count({ where: { bookId: book.id } })
      const beforeFw = await prisma.foreshadowing.count({ where: { bookId: book.id } })

      await extractMemory({ bookId: book.id, chapterId: ch.id })

      const afterMem = await prisma.memoryItem.count({ where: { bookId: book.id } })
      const afterFw = await prisma.foreshadowing.count({ where: { bookId: book.id } })
      console.log(`   记忆提取: +${afterMem - beforeMem} 条记忆, +${afterFw - beforeFw} 条伏笔 (${formatTime(Date.now() - memStart)})`)
    } catch (e) {
      console.error(`   第${i + 1}章失败:`, e instanceof Error ? e.message : e)
    }

    if (i < 2) await sleep(3000)
  }

  // 7. 总结报告
  const overallDuration = Date.now() - overallStart
  console.log('\n\n=== 测试报告 ===')
  console.log(`总耗时: ${formatTime(overallDuration)}`)

  const runs = await prisma.generationRun.findMany({ where: { bookId: book.id } })
  const totalCost = runs.reduce((s, r) => s + (r.costEstimate || 0), 0)
  const totalInput = runs.reduce((s, r) => s + (r.inputTokens || 0), 0)
  const totalOutput = runs.reduce((s, r) => s + (r.outputTokens || 0), 0)
  console.log(`总调用: ${runs.length} 次`)
  console.log(`总成本: ${totalCost.toFixed(4)} 元`)
  console.log(`总tokens: ${totalInput.toLocaleString()} → ${totalOutput.toLocaleString()}`)

  const finalizedChapters = await prisma.chapter.findMany({
    where: { bookId: book.id, status: 'finalized' },
  })
  const totalWords = finalizedChapters.reduce((s, c) => s + (c.wordCount || 0), 0)
  console.log(`定稿章数: ${finalizedChapters.length} / 3`)
  console.log(`总字数: ${totalWords}`)

  const allMem = await prisma.memoryItem.findMany({ where: { bookId: book.id } })
  const allFw = await prisma.foreshadowing.findMany({ where: { bookId: book.id } })
  console.log(`记忆库: ${allMem.length} 条`)
  console.log(`伏笔: ${allFw.length} 条`)

  console.log('\n=== 测试完成 ===')
}

main()
  .catch((e) => {
    console.error('\n测试失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
