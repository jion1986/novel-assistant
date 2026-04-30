/**
 * 综合功能测试 — 记忆库编辑 + 伏笔管理 + 章节创建
 */

import { prisma } from '../lib/db'

async function runTest() {
  console.log('=== 综合功能测试 ===\n')

  // 创建测试小说
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `综合测试_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试全部前台功能',
    },
  })
  console.log(`[setup] 测试小说: ${book.id}`)

  // 创建两个章节用于插入测试
  const ch1 = await prisma.chapter.create({
    data: { bookId: book.id, chapterNumber: 1, title: '第一章', status: 'unwritten' },
  })
  const ch2 = await prisma.chapter.create({
    data: { bookId: book.id, chapterNumber: 2, title: '第二章', status: 'unwritten' },
  })

  // ========== 1. 记忆库 CRUD ==========
  console.log('\n[1/4] 记忆库 CRUD 测试...')

  // 创建
  const mem1 = await prisma.memoryItem.create({
    data: {
      bookId: book.id,
      type: 'event',
      content: '李明发现了镜像世界的入口',
      importance: 'critical',
      isActive: true,
    },
  })
  console.log(`  ✓ 创建记忆: ${mem1.id}`)

  const mem2 = await prisma.memoryItem.create({
    data: {
      bookId: book.id,
      type: 'character',
      content: '张教授 - 神秘学者，知道镜像世界的秘密',
      importance: 'high',
      isActive: true,
    },
  })

  // 更新
  await prisma.memoryItem.update({
    where: { id: mem1.id },
    data: { content: '李明发现了镜像世界的入口并进入其中', importance: 'high' },
  })
  const updatedMem = await prisma.memoryItem.findUnique({ where: { id: mem1.id } })
  if (updatedMem?.content !== '李明发现了镜像世界的入口并进入其中') {
    throw new Error('记忆更新失败')
  }
  console.log(`  ✓ 更新记忆: 内容已修改`)

  // 归档（toggle isActive）
  await prisma.memoryItem.update({
    where: { id: mem2.id },
    data: { isActive: false },
  })
  const inactiveMem = await prisma.memoryItem.findUnique({ where: { id: mem2.id } })
  if (inactiveMem?.isActive !== false) {
    throw new Error('记忆归档失败')
  }
  console.log(`  ✓ 归档记忆: isActive=false`)

  // 删除
  await prisma.memoryItem.delete({ where: { id: mem2.id } })
  const deletedMem = await prisma.memoryItem.findUnique({ where: { id: mem2.id } })
  if (deletedMem) throw new Error('记忆删除失败')
  console.log(`  ✓ 删除记忆: 已移除`)

  // 验证列表
  const remaining = await prisma.memoryItem.findMany({ where: { bookId: book.id } })
  if (remaining.length !== 1) throw new Error(`记忆数量错误: ${remaining.length}`)
  console.log(`  ✓ 列表查询: ${remaining.length} 条活跃记忆`)

  // ========== 2. 伏笔管理 CRUD ==========
  console.log('\n[2/4] 伏笔管理 CRUD 测试...')

  // 创建
  const fw1 = await prisma.foreshadowing.create({
    data: {
      bookId: book.id,
      name: '铜质徽章',
      description: '李明父亲留下的徽章，是打开镜像世界的钥匙',
      status: 'planted',
      setupChapter: '1',
      resolvePlan: '第10章回收',
    },
  })
  console.log(`  ✓ 创建伏笔: ${fw1.id}`)

  const fw2 = await prisma.foreshadowing.create({
    data: {
      bookId: book.id,
      name: '镜中倒影',
      description: '李明在镜中看到的另一个自己',
      status: 'planted',
      setupChapter: '1',
    },
  })

  // 更新状态
  await prisma.foreshadowing.update({
    where: { id: fw1.id },
    data: { status: 'developed', resolveChapter: '5' },
  })
  const updatedFw = await prisma.foreshadowing.findUnique({ where: { id: fw1.id } })
  if (updatedFw?.status !== 'developed') throw new Error('伏笔状态更新失败')
  console.log(`  ✓ 更新伏笔: status → developed`)

  // 删除
  await prisma.foreshadowing.delete({ where: { id: fw2.id } })
  const deletedFw = await prisma.foreshadowing.findUnique({ where: { id: fw2.id } })
  if (deletedFw) throw new Error('伏笔删除失败')
  console.log(`  ✓ 删除伏笔: 已移除`)

  // 验证列表
  const remainingFw = await prisma.foreshadowing.findMany({ where: { bookId: book.id } })
  if (remainingFw.length !== 1) throw new Error(`伏笔数量错误: ${remainingFw.length}`)
  console.log(`  ✓ 列表查询: ${remainingFw.length} 条伏笔`)

  // ========== 3. 章节创建/插入 ==========
  console.log('\n[3/4] 章节创建/插入测试...')

  // 验证已有章节
  const beforeChapters = await prisma.chapter.findMany({
    where: { bookId: book.id },
    orderBy: { chapterNumber: 'asc' },
  })
  console.log(`  现有章节: ${beforeChapters.map(c => `${c.chapterNumber}:${c.title}`).join(', ')}`)

  // 模拟在中间插入（第1章后插入新章节）
  await prisma.chapter.updateMany({
    where: { bookId: book.id, chapterNumber: { gte: 2 } },
    data: { chapterNumber: { increment: 1 } },
  })
  const inserted = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 2,
      title: '插入的章节',
      status: 'unwritten',
    },
  })

  const afterChapters = await prisma.chapter.findMany({
    where: { bookId: book.id },
    orderBy: { chapterNumber: 'asc' },
  })
  console.log(`  插入后: ${afterChapters.map(c => `${c.chapterNumber}:${c.title}`).join(', ')}`)

  if (afterChapters.length !== 3) throw new Error(`章节数量错误: ${afterChapters.length}`)
  if (afterChapters[1].title !== '插入的章节') throw new Error('插入位置错误')
  if (afterChapters[2].chapterNumber !== 3) throw new Error('后续章节未正确后移')
  console.log(`  ✓ 中间插入成功，后续章节自动后移`)

  // 末尾追加
  const lastCh = await prisma.chapter.findFirst({
    where: { bookId: book.id },
    orderBy: { chapterNumber: 'desc' },
  })
  const appended = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: (lastCh?.chapterNumber || 0) + 1,
      title: '末尾追加章节',
      status: 'unwritten',
    },
  })
  console.log(`  ✓ 末尾追加: 第${appended.chapterNumber}章《${appended.title}》`)

  // ========== 4. 成本统计 ==========
  console.log('\n[4/4] 成本统计测试...')

  await prisma.generationRun.create({
    data: {
      bookId: book.id,
      chapterId: ch1.id,
      taskType: 'write',
      inputTokens: 1200,
      outputTokens: 3500,
      model: 'moonshot-v1-8k',
      result: 'success',
      costEstimate: 0.0564,
    },
  })
  await prisma.generationRun.create({
    data: {
      bookId: book.id,
      chapterId: ch1.id,
      taskType: 'extract_memory',
      inputTokens: 800,
      outputTokens: 400,
      model: 'moonshot-v1-8k',
      result: 'success',
      costEstimate: 0.0144,
    },
  })

  const runs = await prisma.generationRun.findMany({ where: { bookId: book.id } })
  const totalCost = runs.reduce((s, r) => s + (r.costEstimate || 0), 0)
  const totalInput = runs.reduce((s, r) => s + (r.inputTokens || 0), 0)
  const totalOutput = runs.reduce((s, r) => s + (r.outputTokens || 0), 0)

  if (totalCost !== 0.0708) throw new Error(`成本统计错误: ${totalCost}`)
  if (totalInput !== 2000) throw new Error(`Input tokens 错误: ${totalInput}`)
  if (totalOutput !== 3900) throw new Error(`Output tokens 错误: ${totalOutput}`)
  console.log(`  ✓ 累计成本: ${totalCost.toFixed(4)} 元`)
  console.log(`  ✓ 总 tokens: ${totalInput} → ${totalOutput}`)

  // 清理
  console.log('\n[清理] 删除测试数据...')
  await prisma.book.delete({ where: { id: book.id } })
  console.log('  ✓ 已清理')

  console.log('\n=== 全部测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
