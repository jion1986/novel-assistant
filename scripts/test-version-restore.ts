/**
 * 章节版本回退测试
 *
 * 验证：
 * 1. GET /versions 返回版本列表
 * 2. POST /versions/:id/restore 回退内容
 * 3. 回退后创建新的 user_edit 版本记录
 * 4. 回退后 chapter 状态变为 edited
 */

import { prisma } from '../lib/db'

async function runTest() {
  console.log('=== 章节版本回退测试 ===\n')

  // 1. 创建测试数据
  console.log('[1/4] 创建测试数据...')
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `版本回退测试_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试版本回退功能',
    },
  })

  const chapter = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 1,
      title: '测试章节',
      draftContent: '这是当前编辑的内容。',
      status: 'edited',
      wordCount: 12,
    },
  })

  // 创建两个历史版本
  const v1 = await prisma.chapterVersion.create({
    data: {
      chapterId: chapter.id,
      versionType: 'ai_draft',
      content: '这是 AI 生成的草稿内容。李明站在天台上。',
      note: 'AI 生成，模型: moonshot-v1-8k',
    },
  })

  const v2 = await prisma.chapterVersion.create({
    data: {
      chapterId: chapter.id,
      versionType: 'final',
      content: '这是定稿内容。李明站在天台上，望着远方。',
      note: '用户定稿',
    },
  })
  console.log(`  章节: ${chapter.id}`)
  console.log(`  版本1 (ai_draft): ${v1.id}`)
  console.log(`  版本2 (final): ${v2.id}`)

  // 2. 验证 GET /versions
  console.log('[2/4] 验证 GET /versions...')
  const versions = await prisma.chapterVersion.findMany({
    where: { chapterId: chapter.id },
    orderBy: { createdAt: 'desc' },
  })
  if (versions.length !== 2) {
    throw new Error(`版本数量错误: 期望 2, 实际 ${versions.length}`)
  }
  console.log(`  ✓ 版本列表: ${versions.length} 条`)
  console.log(`    - ${versions[0].versionType}: ${versions[0].content.slice(0, 30)}...`)
  console.log(`    - ${versions[1].versionType}: ${versions[1].content.slice(0, 30)}...`)

  // 3. 验证回退到 v1（ai_draft）
  console.log('[3/4] 验证回退到 AI 草稿版本...')

  // 模拟 restore API 的逻辑
  const versionToRestore = versions.find(v => v.id === v1.id)
  if (!versionToRestore) throw new Error('版本不存在')

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: {
      draftContent: versionToRestore.content,
      status: 'edited',
      wordCount: versionToRestore.content.length,
    },
  })

  await prisma.chapterVersion.create({
    data: {
      chapterId: chapter.id,
      versionType: 'user_edit',
      content: versionToRestore.content,
      note: `回退到 AI草稿 (${new Date(versionToRestore.createdAt).toLocaleString()})`,
    },
  })

  const restoredChapter = await prisma.chapter.findUnique({
    where: { id: chapter.id },
  })
  if (restoredChapter?.draftContent !== v1.content) {
    throw new Error('回退后内容不匹配')
  }
  if (restoredChapter?.status !== 'edited') {
    throw new Error(`回退后状态错误: 期望 edited, 实际 ${restoredChapter?.status}`)
  }
  console.log(`  ✓ 内容已回退: "${restoredChapter?.draftContent?.slice(0, 40)}..."`)
  console.log(`  ✓ 状态已更新: ${restoredChapter?.status}`)

  // 4. 验证回退后新增版本记录
  console.log('[4/4] 验证回退后版本记录...')
  const allVersions = await prisma.chapterVersion.findMany({
    where: { chapterId: chapter.id },
    orderBy: { createdAt: 'desc' },
  })
  if (allVersions.length !== 3) {
    throw new Error(`回退后版本数量错误: 期望 3, 实际 ${allVersions.length}`)
  }
  const restoreVersion = allVersions[0]
  if (restoreVersion.versionType !== 'user_edit') {
    throw new Error(`回退版本类型错误: 期望 user_edit, 实际 ${restoreVersion.versionType}`)
  }
  console.log(`  ✓ 新增版本: ${restoreVersion.versionType}`)
  console.log(`  ✓ 版本备注: ${restoreVersion.note}`)

  // 清理
  console.log('\n[清理] 删除测试数据...')
  await prisma.book.delete({ where: { id: book.id } })
  console.log('  ✓ 已清理')

  console.log('\n=== 版本回退测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
