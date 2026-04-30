/**
 * 用户系统 + Prompt 版本管理测试
 */

import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'

async function runTest() {
  console.log('=== 用户系统 + Prompt 版本管理测试 ===\n')

  // 1. 用户注册
  console.log('[1/3] 用户注册...')
  const passwordHash = await bcrypt.hash('testpass123', 10)
  const user = await prisma.user.create({
    data: { username: `testuser_${Date.now()}`, password: passwordHash },
  })
  console.log(`  ✓ 注册成功: ${user.username}`)

  // 验证密码
  const valid = await bcrypt.compare('testpass123', user.password)
  if (!valid) throw new Error('密码哈希验证失败')
  console.log(`  ✓ 密码哈希验证通过`)

  // 2. Prompt 版本 CRUD
  console.log('[2/3] Prompt 版本管理...')

  const v1 = await prisma.promptVersion.create({
    data: {
      taskType: 'write',
      version: 'v1.0',
      content: '你是一个小说写手...',
      isActive: true,
      note: '初始版本',
    },
  })
  console.log(`  ✓ 创建版本: ${v1.version}`)

  const v2 = await prisma.promptVersion.create({
    data: {
      taskType: 'write',
      version: 'v1.1',
      content: '你是一个专业小说写手...',
      isActive: false,
      note: '优化版',
    },
  })

  // 激活 v2，取消 v1
  await prisma.promptVersion.updateMany({
    where: { taskType: 'write', isActive: true },
    data: { isActive: false },
  })
  await prisma.promptVersion.update({
    where: { id: v2.id },
    data: { isActive: true },
  })

  const activeVersions = await prisma.promptVersion.findMany({
    where: { taskType: 'write', isActive: true },
  })
  if (activeVersions.length !== 1) throw new Error(`激活版本数量错误: ${activeVersions.length}`)
  if (activeVersions[0].id !== v2.id) throw new Error('激活版本不是 v2')
  console.log(`  ✓ 激活切换: v1.1 已激活`)

  // 删除
  await prisma.promptVersion.delete({ where: { id: v1.id } })
  const remaining = await prisma.promptVersion.findMany({ where: { taskType: 'write' } })
  if (remaining.length !== 1) throw new Error(`删除后数量错误: ${remaining.length}`)
  console.log(`  ✓ 删除版本: v1.0 已移除`)

  // 3. 验证 package.json 测试脚本
  console.log('[3/3] 测试套件配置...')
  const fs = await import('fs/promises')
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
  if (!pkg.scripts.test) throw new Error('package.json 缺少 test 脚本')
  if (!pkg.scripts['test:watch']) throw new Error('package.json 缺少 test:watch 脚本')
  console.log(`  ✓ package.json 测试脚本已配置`)

  const vitestConfig = await fs.readFile('vitest.config.ts', 'utf-8')
  if (!vitestConfig.includes('jsdom')) throw new Error('vitest.config.ts 缺少 jsdom 配置')
  console.log(`  ✓ vitest 配置正确`)

  // 清理
  await prisma.user.delete({ where: { id: user.id } })
  await prisma.promptVersion.deleteMany({ where: { taskType: 'write' } })
  console.log('\n[清理] 已清理测试数据')

  console.log('\n=== 测试通过 ===')
}

runTest().catch((err) => {
  console.error('\n❌ 测试失败:', err.message)
  process.exit(1)
})
