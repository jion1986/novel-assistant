/**
 * 章节摘要 AI 集成测试
 *
 * 验证 generateSummary 函数实际调用 AI 并正确保存结果
 */

import { prisma } from '../lib/db'
import { generateSummary } from '../lib/ai/generateSummary'

async function runTest() {
  console.log('=== 章节摘要 AI 集成测试 ===\n')

  // 1. 创建测试小说和章节
  console.log('[1/3] 创建测试数据...')
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `AI摘要测试_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试 AI 生成章节摘要',
    },
  })

  const chapter = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 1,
      title: '测试章节：镜像世界',
      finalContent: `李明站在破旧的天台上，望着远处灰蒙蒙的城市天际线。他攥紧了口袋里那枚铜质徽章——这是他父亲留下的唯一遗物。

三天前，一个神秘人找到他，说这枚徽章是打开"镜像世界"的钥匙。他本以为是骗局，直到昨晚，他在镜子里看到了另一个自己。那个"自己"穿着黑色制服，眼神冰冷，嘴唇翕动着说了三个字："快逃吧。"

李明深吸一口气，转身跑向楼梯间。身后传来玻璃碎裂的声音——镜子碎了。他不敢回头，只能拼命奔跑。徽章在口袋里发烫，仿佛在指引方向。`,
      status: 'finalized',
      wordCount: 200,
    },
  })
  console.log(`  章节: ${chapter.id}`)

  // 2. 调用 generateSummary
  console.log('[2/3] 调用 generateSummary 生成摘要...')
  const result = await generateSummary({ chapterId: chapter.id })

  console.log(`  ✓ 摘要生成成功`)
  console.log(`  摘要内容: ${result.summary}`)
  console.log(`  摘要长度: ${result.summary.length} 字`)

  if (result.summary.length < 20) {
    throw new Error('摘要过短，质量可能有问题')
  }
  if (result.summary.length > 500) {
    throw new Error('摘要超过 500 字限制')
  }

  // 3. 验证数据库已更新
  console.log('[3/3] 验证数据库...')
  const updatedChapter = await prisma.chapter.findUnique({
    where: { id: chapter.id },
  })

  if (!updatedChapter?.summary) {
    throw new Error('数据库中 summary 为空')
  }
  if (updatedChapter.summary !== result.summary) {
    throw new Error('数据库 summary 与返回值不一致')
  }

  // 验证 generationRun 记录
  const run = await prisma.generationRun.findFirst({
    where: { chapterId: chapter.id, taskType: 'chapter_summary' },
    orderBy: { createdAt: 'desc' },
  })

  if (!run) {
    throw new Error('未找到 generationRun 记录')
  }
  console.log(`  ✓ 数据库已更新: ${updatedChapter.summary.length} 字`)
  console.log(`  ✓ 成本记录: ${run.inputTokens} → ${run.outputTokens} tokens, 约 ${run.costEstimate?.toFixed(4)} 元`)

  // 清理
  console.log('\n[清理] 删除测试数据...')
  await prisma.book.delete({ where: { id: book.id } })
  console.log('  ✓ 已清理')

  console.log('\n=== AI 集成测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
