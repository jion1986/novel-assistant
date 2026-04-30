/**
 * 端到端测试：验证完整 AI 生成链路
 *
 * 用法：npx tsx --require dotenv/config scripts/e2e-test.ts
 */

import { prisma } from '../lib/db'

const BASE_URL = 'http://localhost:3000'

async function createBook() {
  const res = await fetch(`${BASE_URL}/api/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'E2E测试：情绪读取者',
      genre: '都市异能',
      coreIdea: '一个普通上班族意外获得读取他人情绪的能力，卷入都市阴谋',
      targetWords: 300000,
      style: '快节奏、悬疑感强',
    }),
  })
  const data = await res.json()
  return data.data
}

async function generateSetting(bookId: string) {
  console.log('\n[1/6] 生成设定...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/setting/generate`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  console.log('  世界观:', data.data.storyBible.worldSetting.slice(0, 60) + '...')
  console.log('  故事类型:', data.data.storyBible.storyType)
  console.log('  基调:', data.data.storyBible.tone)
  return data.data.storyBible
}

async function generateCharacters(bookId: string) {
  console.log('\n[2/6] 生成人设...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/characters/generate`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  console.log(`  生成 ${data.data.characters.length} 个角色:`)
  for (const c of data.data.characters) {
    console.log(`    - ${c.name} (${c.role})`)
  }
  return data.data.characters
}

async function generateOutline(bookId: string) {
  console.log('\n[3/6] 生成大纲...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/outline/generate`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  console.log(`  生成 ${data.data.chapters.length} 章:`)
  for (const ch of data.data.chapters.slice(0, 5)) {
    console.log(`    第${ch.chapterNumber}章 ${ch.title}`)
  }
  if (data.data.chapters.length > 5) {
    console.log(`    ... 共 ${data.data.chapters.length} 章`)
  }
  return data.data.chapters
}

async function writeChapter(bookId: string, chapterId: string) {
  console.log('\n[4/6] 写第一章正文...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/chapters/${chapterId}/write`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  const content = data.data.chapter.draftContent || ''
  console.log(`  字数: ${content.length}`)
  console.log('  开头:', content.slice(0, 80).replace(/\n/g, ' ') + '...')
  return data.data.chapter
}

async function finalizeChapter(bookId: string, chapterId: string, content: string) {
  console.log('\n[5/6] 保存定稿...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/chapters/${chapterId}/save-final`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  console.log('  定稿已保存')
  return data.data
}

async function extractMemory(bookId: string, chapterId: string) {
  console.log('\n[6/6] 提取记忆...')
  const res = await fetch(`${BASE_URL}/api/books/${bookId}/chapters/${chapterId}/extract-memory`, { method: 'POST' })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
  console.log(`  新增记忆: ${data.data.memoryItems.length} 条`)
  console.log(`  新增伏笔: ${data.data.foreshadowings.length} 条`)
  if (data.data.nextChapterNotes) {
    console.log('  下章注意:', data.data.nextChapterNotes.slice(0, 80) + '...')
  }
  return data.data
}

async function main() {
  console.log('=== AI 小说助手 端到端测试 ===')
  console.log('注意：此测试会调用 Kimi API，产生实际费用')

  // 清理旧测试数据
  const oldBooks = await prisma.book.findMany({
    where: { title: { startsWith: 'E2E测试' } },
  })
  for (const b of oldBooks) {
    await prisma.book.delete({ where: { id: b.id } })
    console.log('清理旧测试数据:', b.id)
  }

  // 创建小说
  const book = await createBook()
  console.log('\n创建测试项目:', book.id, book.title)

  // 执行完整链路
  const start = Date.now()

  await generateSetting(book.id)
  await generateCharacters(book.id)
  const chapters = await generateOutline(book.id)

  if (chapters.length === 0) throw new Error('大纲未生成章节')

  const chapter1 = await writeChapter(book.id, chapters[0].id)
  await finalizeChapter(book.id, chapter1.id, chapter1.draftContent || '')
  await extractMemory(book.id, chapter1.id)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  // 统计成本
  const runs = await prisma.generationRun.findMany({
    where: { bookId: book.id },
  })
  const totalCost = runs.reduce((sum, r) => sum + (r.costEstimate || 0), 0)
  const totalInput = runs.reduce((sum, r) => sum + (r.inputTokens || 0), 0)
  const totalOutput = runs.reduce((sum, r) => sum + (r.outputTokens || 0), 0)

  console.log('\n=== 测试完成 ===')
  console.log(`总耗时: ${elapsed}s`)
  console.log(`总调用: ${runs.length} 次`)
  console.log(`总输入: ${totalInput} tokens`)
  console.log(`总输出: ${totalOutput} tokens`)
  console.log(`预估成本: ${totalCost.toFixed(4)} 元`)
  console.log('\n链路验证:')
  console.log('  [OK] 创建小说')
  console.log('  [OK] 生成设定')
  console.log('  [OK] 生成人设')
  console.log('  [OK] 生成大纲')
  console.log('  [OK] 写第一章')
  console.log('  [OK] 保存定稿')
  console.log('  [OK] 提取记忆')
}

main()
  .catch((e) => {
    console.error('\n测试失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
