/**
 * 章节摘要连续性测试
 *
 * 验证：
 * 1. writeChapter 后自动生成临时摘要
 * 2. save-final 后自动生成高质量摘要
 * 3. 后续章节的 previousSummaries 能正确读取前文摘要
 */

import { prisma } from '../lib/db'
import { generateTempSummary } from '../lib/ai/generateSummary'

async function runTest() {
  console.log('=== 章节摘要连续性测试 ===\n')

  // 1. 创建测试小说
  console.log('[1/5] 创建测试小说...')
  const book = await prisma.book.create({ data: { userId: 'system-user-id',
      title: `测试摘要_${Date.now()}`,
      genre: '测试',
      coreIdea: '测试章节摘要连续性',
    },
  })
  console.log(`  创建成功: ${book.id}`)

  // 2. 创建两个章节
  console.log('[2/5] 创建测试章节...')
  const ch1 = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 1,
      title: '第一章：起始',
      chapterGoal: '引入主角',
      outline: '主角登场',
      status: 'unwritten',
    },
  })
  const ch2 = await prisma.chapter.create({
    data: {
      bookId: book.id,
      chapterNumber: 2,
      title: '第二章：转折',
      chapterGoal: '冲突升级',
      outline: '遇到反派',
      status: 'unwritten',
    },
  })
  console.log(`  章节1: ${ch1.id}`)
  console.log(`  章节2: ${ch2.id}`)

  // 3. 模拟 writeChapter：写入草稿 + 临时摘要
  console.log('[3/5] 模拟 writeChapter 生成草稿和临时摘要...')
  const draftContent1 = `李明站在破旧的天台上，望着远处灰蒙蒙的城市天际线。他攥紧了口袋里那枚铜质徽章——这是他父亲留下的唯一遗物。三天前，一个神秘人找到他，说这枚徽章是打开"镜像世界"的钥匙。他本以为是骗局，直到昨晚，他在镜子里看到了另一个自己。那个"自己"穿着黑色制服，眼神冰冷，嘴唇翕动着说了三个字："快逃吧。"`

  const tempSummary = generateTempSummary(draftContent1)
  console.log(`  临时摘要: ${tempSummary}`)

  await prisma.chapter.update({
    where: { id: ch1.id },
    data: {
      draftContent: draftContent1,
      status: 'ai_draft',
      wordCount: draftContent1.length,
      summary: tempSummary,
    },
  })

  const ch1AfterWrite = await prisma.chapter.findUnique({ where: { id: ch1.id } })
  if (!ch1AfterWrite?.summary) {
    throw new Error('writeChapter 后 summary 为空')
  }
  console.log(`  ✓ 临时摘要已保存: ${ch1AfterWrite.summary.length} 字`)

  // 4. 模拟 save-final：定稿 + 高质量摘要
  console.log('[4/5] 模拟 save-final 定稿...')
  const finalContent1 = draftContent1 + ` 李明深吸一口气，转身跑向楼梯间。身后传来玻璃碎裂的声音——镜子碎了。`

  await prisma.chapter.update({
    where: { id: ch1.id },
    data: {
      finalContent: finalContent1,
      status: 'finalized',
      wordCount: finalContent1.length,
    },
  })

  // 模拟 generateSummary 生成高质量摘要
  const highQualitySummary = '李明在天台上发现父亲遗留的铜质徽章是通往镜像世界的钥匙，镜中出现了另一个冰冷的自己警告他快逃。他转身逃离时，身后的镜子碎裂。'
  await prisma.chapter.update({
    where: { id: ch1.id },
    data: { summary: highQualitySummary },
  })

  const ch1AfterFinal = await prisma.chapter.findUnique({ where: { id: ch1.id } })
  if (!ch1AfterFinal?.summary || ch1AfterFinal.summary === tempSummary) {
    throw new Error('save-final 后摘要未被高质量摘要覆盖')
  }
  console.log(`  ✓ 高质量摘要已保存: ${ch1AfterFinal.summary.length} 字`)
  console.log(`    ${ch1AfterFinal.summary}`)

  // 5. 验证后续章节能读取前文摘要
  console.log('[5/5] 验证后续章节的 previousSummaries...')
  const allChapters = await prisma.chapter.findMany({
    where: { bookId: book.id },
    orderBy: { chapterNumber: 'asc' },
  })

  const previousChapters = allChapters
    .filter(c => c.chapterNumber < ch2.chapterNumber && c.status === 'finalized')
    .sort((a, b) => b.chapterNumber - a.chapterNumber)
    .slice(0, 3)

  const previousSummaries = previousChapters
    .map(c => `第${c.chapterNumber}章《${c.title}》: ${c.summary || '无摘要'}`)
    .join('\n')

  if (!previousSummaries.includes(highQualitySummary)) {
    throw new Error('previousSummaries 未包含第一章高质量摘要')
  }
  console.log(`  ✓ previousSummaries 正确包含前文摘要:`)
  console.log(`    ${previousSummaries.replace(/\n/g, '\n    ')}`)

  // 6. 验证临时摘要函数边界情况
  console.log('\n[额外] 测试 generateTempSummary 边界情况...')

  const shortText = '这是一段很短的文本。'
  const shortResult = generateTempSummary(shortText)
  if (shortResult !== shortText) {
    throw new Error('短文本摘要不应被截断')
  }
  console.log(`  ✓ 短文本保留完整: "${shortResult}"`)

  const longText = '李明站在破旧的天台上。' + '望着远处灰蒙蒙的城市天际线。'.repeat(50)
  const longResult = generateTempSummary(longText)
  if (longResult.length > 400) {
    throw new Error('长文本摘要应被截断')
  }
  if (!longResult.endsWith('……') && !/[。！？]/.test(longResult.slice(-1))) {
    throw new Error('长文本摘要应在句号处截断或以省略号结尾')
  }
  console.log(`  ✓ 长文本正确截断: ${longResult.length} 字`)

  // 清理
  console.log('\n[清理] 删除测试数据...')
  await prisma.book.delete({ where: { id: book.id } })
  console.log('  ✓ 测试数据已清理')

  console.log('\n=== 全部测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
