/**
 * 10 章深度测试：验证长周期连续生成的稳定性
 *
 * 完整闭环 10 章：生成正文 → 定稿 → 提取记忆
 * 验证：连续性、记忆库增长、角色状态一致性、成本累积
 *
 * 用法：npx tsx --require dotenv/config scripts/deep-test-10chapters.ts
 * 建议：在 API 稳定时段运行（如工作日上午），预计耗时 15-20 分钟
 */

import { prisma } from '../lib/db'

const BASE_URL = 'http://localhost:3000'
const CHAPTERS_TO_TEST = 10
const API_DELAY_MS = 12000 // 每步间隔 12 秒，避免限流

interface TestMetrics {
  chapterNumber: number
  wordCount: number
  inputTokens: number
  outputTokens: number
  cost: number
  memoryItemsAdded: number
  foreshadowingsAdded: number
  durationMs: number
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function post(path: string, body?: object) {
  await sleep(API_DELAY_MS)
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!data.success) throw new Error(`${path} failed: ${data.error}`)
  return data.data
}

async function getBookRuns(bookId: string) {
  return prisma.generationRun.findMany({ where: { bookId } })
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${((ms % 60000) / 1000).toFixed(0)}s`
}

async function main() {
  console.log('=== 10 章深度测试 ===')
  console.log(`测试章节数: ${CHAPTERS_TO_TEST}`)
  console.log(`API 间隔: ${API_DELAY_MS / 1000} 秒`)
  console.log(`预估耗时: ${formatTime(CHAPTERS_TO_TEST * API_DELAY_MS * 3 + 60000)}\n`)

  const overallStart = Date.now()

  // 1. 清理旧测试数据
  const oldBooks = await prisma.book.findMany({
    where: { title: { startsWith: '深度测试' } },
  })
  for (const b of oldBooks) {
    await prisma.book.delete({ where: { id: b.id } })
    console.log('清理旧测试:', b.title)
  }

  // 2. 创建小说
  const book = await post('/api/books', {
    title: '深度测试：星门计划',
    genre: '科幻悬疑',
    coreIdea: '2045年，人类发现太阳系边缘的星门，探测队进入后发现门后是一个由古代文明建造的迷宫网络，每个门通向不同的时间线和现实分支。主角是一名量子物理学家，必须在各个分支中寻找回家的路，同时阻止一个试图控制星门的神秘组织',
    targetWords: 500000,
    style: '硬科幻、悬疑紧张、多时间线叙事',
  })
  console.log('\n创建项目:', book.title)
  console.log('Book ID:', book.id)

  // 3. 生成基础内容
  console.log('\n--- 前置步骤 ---')

  await post(`/api/books/${book.id}/setting/generate`)
  const bible = await prisma.storyBible.findUnique({ where: { bookId: book.id } })
  console.log('设定完成:', bible?.worldSetting?.slice(0, 60) + '...')

  const chars = await post(`/api/books/${book.id}/characters/generate`)
  console.log(`人设完成: ${chars.characters.length} 个角色`)

  const outline = await post(`/api/books/${book.id}/outline/generate`)
  const chapters = outline.chapters
  console.log(`大纲完成: ${chapters.length} 章`)

  if (chapters.length < CHAPTERS_TO_TEST) {
    throw new Error(`大纲仅生成 ${chapters.length} 章，少于测试需要的 ${CHAPTERS_TO_TEST} 章`)
  }

  // 4. 连续写 10 章
  const metrics: TestMetrics[] = []

  console.log('\n=== 开始 10 章连续生成 ===\n')

  for (let i = 0; i < CHAPTERS_TO_TEST; i++) {
    const ch = chapters[i]
    const chapterStart = Date.now()
    console.log(`\n--- 第 ${i + 1} 章: ${ch.title} ---`)

    // 写正文
    const beforeRuns = await getBookRuns(book.id)
    const writeResult = await post(`/api/books/${book.id}/chapters/${ch.id}/write`)
    const afterRuns = await getBookRuns(book.id)
    const newRuns = afterRuns.filter((r) => !beforeRuns.find((br) => br.id === r.id))

    const content = writeResult.chapter.draftContent || ''
    const chapterCost = newRuns.reduce((s, r) => s + (r.costEstimate || 0), 0)
    const chapterInput = newRuns.reduce((s, r) => s + (r.inputTokens || 0), 0)
    const chapterOutput = newRuns.reduce((s, r) => s + (r.outputTokens || 0), 0)

    console.log(`  字数: ${content.length}`)
    console.log(`  开头: ${content.slice(0, 50).replace(/\n/g, ' ')}...`)
    console.log(`  本章成本: ${chapterCost.toFixed(4)} 元 (${chapterInput}/${chapterOutput} tokens)`)

    // 定稿
    await post(`/api/books/${book.id}/chapters/${ch.id}/save-final`, { content })
    console.log('  定稿已保存')

    // 提取记忆
    const beforeMem = await prisma.memoryItem.count({ where: { bookId: book.id } })
    const beforeFw = await prisma.foreshadowing.count({ where: { bookId: book.id } })

    await post(`/api/books/${book.id}/chapters/${ch.id}/extract-memory`)

    const afterMem = await prisma.memoryItem.count({ where: { bookId: book.id } })
    const afterFw = await prisma.foreshadowing.count({ where: { bookId: book.id } })

    const memAdded = afterMem - beforeMem
    const fwAdded = afterFw - beforeFw
    console.log(`  记忆: +${memAdded} 条, 伏笔: +${fwAdded} 条`)

    const duration = Date.now() - chapterStart
    console.log(`  耗时: ${formatTime(duration)}`)

    metrics.push({
      chapterNumber: i + 1,
      wordCount: content.length,
      inputTokens: chapterInput,
      outputTokens: chapterOutput,
      cost: chapterCost,
      memoryItemsAdded: memAdded,
      foreshadowingsAdded: fwAdded,
      durationMs: duration,
    })
  }

  // 5. 综合报告
  console.log('\n\n=== 10 章深度测试报告 ===\n')

  // 5.1 章节统计表
  console.log('章节明细:')
  console.log('章 | 字数 | 输入T | 输出T | 成本(元) | 记忆+ | 伏笔+ | 耗时')
  console.log('-'.repeat(80))
  for (const m of metrics) {
    console.log(
      `${m.chapterNumber.toString().padStart(2)} | ` +
      `${m.wordCount.toString().padStart(5)} | ` +
      `${m.inputTokens.toString().padStart(5)} | ` +
      `${m.outputTokens.toString().padStart(5)} | ` +
      `${m.cost.toFixed(4).padStart(8)} | ` +
      `${m.memoryItemsAdded.toString().padStart(3)} | ` +
      `${m.foreshadowingsAdded.toString().padStart(3)} | ` +
      `${formatTime(m.durationMs)}`
    )
  }

  // 5.2 汇总统计
  const totalWords = metrics.reduce((s, m) => s + m.wordCount, 0)
  const totalInput = metrics.reduce((s, m) => s + m.inputTokens, 0)
  const totalOutput = metrics.reduce((s, m) => s + m.outputTokens, 0)
  const totalCost = metrics.reduce((s, m) => s + m.cost, 0)
  const totalMem = metrics.reduce((s, m) => s + m.memoryItemsAdded, 0)
  const totalFw = metrics.reduce((s, m) => s + m.foreshadowingsAdded, 0)
  const avgWords = Math.round(totalWords / CHAPTERS_TO_TEST)

  console.log('-'.repeat(80))
  console.log(
    `合计 | ${totalWords.toString().padStart(5)} | ` +
    `${totalInput.toString().padStart(5)} | ` +
    `${totalOutput.toString().padStart(5)} | ` +
    `${totalCost.toFixed(4).padStart(8)} | ` +
    `${totalMem.toString().padStart(3)} | ` +
    `${totalFw.toString().padStart(3)}`
  )

  // 5.3 连续性验证
  console.log('\n连续性验证:')

  // 角色状态一致性
  const allChars = await prisma.character.findMany({ where: { bookId: book.id } })
  const charsWithStatus = allChars.filter((c) => c.currentStatus)
  console.log(`  角色状态追踪: ${charsWithStatus.length}/${allChars.length} 个角色有状态记录`)
  for (const c of charsWithStatus.slice(0, 3)) {
    console.log(`    ${c.name}: ${c.currentStatus?.slice(0, 60)}...`)
  }
  if (charsWithStatus.length > 3) {
    console.log(`    ... 共 ${charsWithStatus.length} 个`)
  }

  // 记忆库分析
  const allMemory = await prisma.memoryItem.findMany({
    where: { bookId: book.id },
    orderBy: { createdAt: 'asc' },
  })
  const memByType: Record<string, number> = {}
  for (const m of allMemory) {
    memByType[m.type] = (memByType[m.type] || 0) + 1
  }
  console.log('\n  记忆库类型分布:')
  for (const [type, count] of Object.entries(memByType)) {
    console.log(`    ${type}: ${count} 条`)
  }

  // 伏笔状态
  const allFw = await prisma.foreshadowing.findMany({ where: { bookId: book.id } })
  const fwByStatus: Record<string, number> = {}
  for (const f of allFw) {
    fwByStatus[f.status] = (fwByStatus[f.status] || 0) + 1
  }
  console.log('\n  伏笔状态分布:')
  for (const [status, count] of Object.entries(fwByStatus)) {
    console.log(`    ${status}: ${count} 条`)
  }

  // 字数分布
  const wordCounts = metrics.map((m) => m.wordCount)
  const minWords = Math.min(...wordCounts)
  const maxWords = Math.max(...wordCounts)
  console.log(`\n  字数分布: 最小 ${minWords} | 最大 ${maxWords} | 平均 ${avgWords}`)

  // 检查字数是否稳定（标准差）
  const variance = wordCounts.reduce((s, w) => s + Math.pow(w - avgWords, 2), 0) / wordCounts.length
  const stdDev = Math.sqrt(variance)
  console.log(`  字数标准差: ${Math.round(stdDev)} (${((stdDev / avgWords) * 100).toFixed(1)}%)`)

  // 5.4 总体评估
  console.log('\n=== 总体评估 ===')
  const overallDuration = Date.now() - overallStart
  console.log(`总耗时: ${formatTime(overallDuration)}`)
  console.log(`总调用: ${await prisma.generationRun.count({ where: { bookId: book.id } })} 次`)
  console.log(`总成本: ${totalCost.toFixed(4)} 元`)
  console.log(`总字数: ${totalWords} (${(totalWords / 10000).toFixed(1)} 万字)`)

  // 连续性评分
  const continuityScore = Math.min(100, Math.round(
    (charsWithStatus.length / Math.max(1, allChars.length)) * 30 +
    (totalMem > 0 ? 30 : 0) +
    (totalFw > 0 ? 20 : 0) +
    (stdDev / avgWords < 0.3 ? 20 : 10)
  ))
  console.log(`连续性评分: ${continuityScore}/100`)

  if (continuityScore >= 80) {
    console.log('\n结论: 系统在长周期连续生成中表现良好，记忆库和角色追踪正常工作。')
  } else if (continuityScore >= 60) {
    console.log('\n结论: 系统基本可用，但连续性有提升空间。')
  } else {
    console.log('\n结论: 连续性存在明显问题，建议检查记忆提取和上下文传递。')
  }

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
