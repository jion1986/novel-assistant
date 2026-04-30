/**
 * 连续章节测试：验证记忆库是否能保持连续性
 *
 * 跑 3 章完整闭环：生成 → 定稿 → 提取记忆 → 下一章基于记忆继续写
 */

import { prisma } from '../lib/db'

const BASE_URL = 'http://localhost:3000'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function post(path: string, body?: object) {
  await sleep(8000) // API 调用间隔 8 秒，避免限流
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!data.success) throw new Error(`${path} failed: ${data.error}`)
  return data.data
}

async function main() {
  console.log('=== 连续章节连续性测试 ===\n')

  // 清理旧数据
  const old = await prisma.book.findMany({ where: { title: { startsWith: '连续性测试' } } })
  for (const b of old) await prisma.book.delete({ where: { id: b.id } })

  // 1. 创建小说
  const book = await post('/api/books', {
    title: '连续性测试：情绪读取者',
    genre: '都市异能',
    coreIdea: '一个普通上班族意外获得读取他人情绪的能力，卷入都市阴谋',
    targetWords: 100000,
    style: '快节奏、悬疑感强',
  })
  console.log('创建项目:', book.title)

  // 2. 生成设定
  await post(`/api/books/${book.id}/setting/generate`)
  const bible = await prisma.storyBible.findUnique({ where: { bookId: book.id } })
  console.log('\n设定生成完成:')
  console.log('  世界观:', bible?.worldSetting?.slice(0, 80) + '...')
  console.log('  基调:', bible?.tone)

  // 3. 生成人设
  const chars = await post(`/api/books/${book.id}/characters/generate`)
  console.log(`\n人设生成完成: ${chars.characters.length} 个角色`)
  for (const c of chars.characters) console.log(`  - ${c.name} (${c.role})`)

  // 4. 生成大纲
  const outline = await post(`/api/books/${book.id}/outline/generate`)
  const chapters = outline.chapters
  console.log(`\n大纲生成完成: ${chapters.length} 章`)

  // 5. 连续写 3 章
  for (let i = 0; i < Math.min(3, chapters.length); i++) {
    const ch = chapters[i]
    console.log(`\n--- 第 ${i + 1} 章 ---`)

    // 写正文
    const result = await post(`/api/books/${book.id}/chapters/${ch.id}/write`)
    const content = result.chapter.draftContent || ''
    console.log(`生成正文: ${content.length} 字`)
    console.log('开头:', content.slice(0, 60).replace(/\n/g, ' ') + '...')

    // 保存定稿
    await post(`/api/books/${book.id}/chapters/${ch.id}/save-final`, { content })
    console.log('定稿已保存')

    // 提取记忆
    const mem = await post(`/api/books/${book.id}/chapters/${ch.id}/extract-memory`)
    console.log(`记忆提取: ${mem.memoryItems.length} 条记忆, ${mem.foreshadowings.length} 条伏笔`)
    if (mem.nextChapterNotes) {
      console.log('下章注意:', mem.nextChapterNotes.slice(0, 60) + '...')
    }

    // 检查当前记忆库状态
    const currentMemory = await prisma.memoryItem.findMany({ where: { bookId: book.id } })
    const currentFw = await prisma.foreshadowing.findMany({ where: { bookId: book.id } })
    console.log(`记忆库状态: ${currentMemory.length} 条记忆, ${currentFw.length} 条伏笔`)
  }

  // 6. 连续性观察
  console.log('\n=== 连续性观察 ===')

  const allChars = await prisma.character.findMany({ where: { bookId: book.id } })
  console.log('\n角色状态变化:')
  for (const c of allChars) {
    if (c.currentStatus) {
      console.log(`  ${c.name}: ${c.currentStatus.slice(0, 80)}`)
    }
  }

  const allMemory = await prisma.memoryItem.findMany({
    where: { bookId: book.id },
    orderBy: { createdAt: 'asc' },
  })
  console.log('\n记忆库内容:')
  for (const m of allMemory) {
    console.log(`  [${m.type}] ${m.content.slice(0, 60)}`)
  }

  const allFw = await prisma.foreshadowing.findMany({ where: { bookId: book.id } })
  console.log('\n伏笔追踪:')
  for (const f of allFw) {
    console.log(`  ${f.name} (${f.status}): ${f.description.slice(0, 60)}`)
  }

  // 7. 检查第2章和第3章是否引用了前面的记忆
  const ch2 = await prisma.chapter.findUnique({ where: { id: chapters[1].id } })
  const ch3 = await prisma.chapter.findUnique({ where: { id: chapters[2].id } })

  console.log('\n=== 连续性检查 ===')
  console.log(`第2章字数: ${ch2?.draftContent?.length || 0}`)
  console.log(`第3章字数: ${ch3?.draftContent?.length || 0}`)

  // 检查关键角色名是否出现
  const protagonist = allChars.find(c => c.role === 'protagonist')?.name || '主角'
  console.log(`\n主角名"${protagonist}"出现次数:`)
  console.log(`  第1章: ${(chapters[0].draftContent || '').split(protagonist).length - 1} 次`)
  console.log(`  第2章: ${(ch2?.draftContent || '').split(protagonist).length - 1} 次`)
  console.log(`  第3章: ${(ch3?.draftContent || '').split(protagonist).length - 1} 次`)

  // 成本统计
  const runs = await prisma.generationRun.findMany({ where: { bookId: book.id } })
  const totalCost = runs.reduce((s, r) => s + (r.costEstimate || 0), 0)
  console.log(`\n总成本: ${totalCost.toFixed(4)} 元 (${runs.length} 次调用)`)

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
