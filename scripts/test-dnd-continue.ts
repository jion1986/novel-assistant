/**
 * 拖拽重排 + 续写功能测试
 */

import { prisma } from '../lib/db'

async function runTest() {
  console.log('=== 拖拽重排 + 续写功能测试 ===\n')

  // 创建测试数据
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `重排续写测试_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试拖拽重排和续写',
    },
  })

  const ch1 = await prisma.chapter.create({
    data: { bookId: book.id, chapterNumber: 1, title: '第一章', status: 'unwritten' },
  })
  const ch2 = await prisma.chapter.create({
    data: { bookId: book.id, chapterNumber: 2, title: '第二章', status: 'unwritten' },
  })
  const ch3 = await prisma.chapter.create({
    data: { bookId: book.id, chapterNumber: 3, title: '第三章', status: 'unwritten' },
  })

  // 1. 测试重排 API
  console.log('[1/2] 测试章节重排 API...')

  // 模拟拖拽：将第三章移到第一位（顺序变为 3, 1, 2）
  const reorderedIds = [ch3.id, ch1.id, ch2.id]

  // 使用临时值避免唯一键冲突
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < reorderedIds.length; i++) {
      await tx.chapter.update({
        where: { id: reorderedIds[i], bookId: book.id },
        data: { chapterNumber: 10000 + i },
      })
    }
    for (let i = 0; i < reorderedIds.length; i++) {
      await tx.chapter.update({
        where: { id: reorderedIds[i], bookId: book.id },
        data: { chapterNumber: i + 1 },
      })
    }
  })

  const afterReorder = await prisma.chapter.findMany({
    where: { bookId: book.id },
    orderBy: { chapterNumber: 'asc' },
  })

  if (afterReorder[0].id !== ch3.id) throw new Error('重排后第一位置错误')
  if (afterReorder[1].id !== ch1.id) throw new Error('重排后第二位置错误')
  if (afterReorder[2].id !== ch2.id) throw new Error('重排后第三位置错误')
  if (afterReorder[0].chapterNumber !== 1) throw new Error('重排后 chapterNumber 未更新')

  console.log(`  ✓ 重排成功: ${afterReorder.map(c => c.title).join(' → ')}`)

  // 2. 测试续写 API 的数据准备
  console.log('[2/2] 测试续写数据准备...')

  await prisma.chapter.update({
    where: { id: ch1.id },
    data: {
      draftContent: '李明站在天台上，望着远方。',
      chapterGoal: '引入主角',
      outline: '主角登场，发现异常',
    },
  })

  const chapterForContinue = await prisma.chapter.findUnique({
    where: { id: ch1.id },
    include: { book: { include: { storyBible: true, characters: true } } },
  })

  if (!chapterForContinue?.draftContent) throw new Error('章节内容为空')
  console.log(`  ✓ 续写数据准备完成: ${chapterForContinue.draftContent.length} 字`)
  console.log(`  ✓ 上下文包含: ${chapterForContinue.book.characters.length} 个角色`)

  // 清理
  await prisma.book.delete({ where: { id: book.id } })
  console.log('\n[清理] 已清理测试数据')

  console.log('\n=== 测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
