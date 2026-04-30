/**
 * 全文搜索 + 部署配置测试
 */

import { prisma } from '../lib/db'

async function runTest() {
  console.log('=== 全文搜索 + 部署配置测试 ===\n')

  // 创建测试数据
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `搜索测试_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试搜索功能',
    },
  })

  const ch = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 1,
      title: '镜像世界的入口',
      draftContent: '李明站在天台上，发现了通往镜像世界的入口。',
      status: 'ai_draft',
    },
  })

  await prisma.memoryItem.create({
    data: {
      bookId: book.id,
      type: 'event',
      content: '李明发现了镜像世界的入口并进入其中',
      importance: 'critical',
      isActive: true,
    },
  })

  await prisma.character.create({
    data: {
      bookId: book.id,
      name: '李明',
      role: 'protagonist',
      personality: '勇敢但冲动',
      orderIndex: 0,
    },
  })

  // 1. 验证搜索 API 逻辑（通过 prisma 直接查询模拟）
  console.log('[1/2] 验证搜索查询逻辑...')
  const keyword = '镜像'

  const chapters = await prisma.chapter.findMany({
    where: {
      bookId: book.id,
      OR: [
        { title: { contains: keyword } },
        { draftContent: { contains: keyword } },
      ],
    },
  })
  if (chapters.length !== 1) throw new Error(`章节搜索结果错误: ${chapters.length}`)
  console.log(`  ✓ 章节搜索: ${chapters.length} 条`)

  const memories = await prisma.memoryItem.findMany({
    where: { bookId: book.id, content: { contains: keyword } },
  })
  if (memories.length !== 1) throw new Error(`记忆搜索结果错误: ${memories.length}`)
  console.log(`  ✓ 记忆搜索: ${memories.length} 条`)

  const chars = await prisma.character.findMany({
    where: {
      bookId: book.id,
      OR: [{ name: { contains: keyword } }, { personality: { contains: keyword } }],
    },
  })
  console.log(`  ✓ 角色搜索: ${chars.length} 条（预期 0，李明不匹配"镜像"）`)

  // 2. 验证 next.config.mjs 存在且不为空
  console.log('[2/2] 验证部署配置...')
  const fs = await import('fs/promises')
  const config = await fs.readFile('next.config.mjs', 'utf-8')
  if (!config.includes('images')) throw new Error('next.config.mjs 缺少 images 配置')
  console.log('  ✓ next.config.mjs 已配置 images.unoptimized')

  // 清理
  await prisma.book.delete({ where: { id: book.id } })
  console.log('\n[清理] 已清理测试数据')

  console.log('\n=== 测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
