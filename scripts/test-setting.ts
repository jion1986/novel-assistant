/**
 * 测试脚本：验证设定生成功能
 *
 * 用法：npx tsx scripts/test-setting.ts
 */

import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local', override: true })

import { prisma } from '../lib/db'
import { generateSetting } from '../lib/ai/generateSetting'

async function main() {
  // 0. 确保测试用户存在
  const user = await prisma.user.upsert({
    where: { username: 'test' },
    update: {},
    create: { username: 'test', password: 'test-hash-not-used' },
  })

  // 1. 创建一个测试小说项目
  const book = await prisma.book.create({ data: { userId: user.id,
      title: '测试小说：情绪读取者',
      genre: '都市异能',
      coreIdea: '一个普通上班族意外获得读取他人情绪的能力，卷入都市阴谋',
      targetWords: 300000,
      style: '快节奏、悬疑感强',
    },
  })

  console.log('创建测试项目:', book.id, book.title)

  // 2. 调用设定生成
  console.log('开始生成设定...')
  const start = Date.now()

  try {
    const result = await generateSetting({ bookId: book.id })

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\n生成成功！耗时 ${elapsed}s`)
    console.log('\n--- 生成结果 ---')
    console.log('世界观:', result.storyBible.worldSetting)
    console.log('故事类型:', result.storyBible.storyType)
    console.log('基调:', result.storyBible.tone)
    console.log('核心冲突:', result.storyBible.coreConflict)
    console.log('卖点:', result.storyBible.sellingPoints)
    console.log('力量体系:', result.storyBible.powerSystem)
    console.log('规则:', result.storyBible.rules)

    // 3. 查询生成记录
    const runs = await prisma.generationRun.findMany({
      where: { bookId: book.id },
    })

    console.log('\n--- 生成记录 ---')
    for (const run of runs) {
      console.log(`任务: ${run.taskType}, 输入: ${run.inputTokens} tokens, 输出: ${run.outputTokens} tokens, 模型: ${run.model}, 预估成本: ${run.costEstimate?.toFixed(4)}元`)
    }
  } catch (error) {
    console.error('生成失败:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
