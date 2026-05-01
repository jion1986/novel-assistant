#!/usr/bin/env node
/**
 * 代码完整性验证脚本（纯 Node.js，不依赖外部原生模块）
 * 用于在无法运行完整 verify:local 的环境中做补充验证
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const errors = []
const warnings = []
let passCount = 0

function check(name, condition, errorMsg) {
  if (condition) {
    passCount++
    process.stdout.write('✓')
  } else {
    errors.push(`${name}: ${errorMsg}`)
    process.stdout.write('✗')
  }
}


console.log('代码完整性验证开始...\n')

// === 1. 关键配置文件 ===
console.log('\n[配置文件]')
check('package.json', existsSync(join(ROOT, 'package.json')), '缺失')
check('next.config.mjs', existsSync(join(ROOT, 'next.config.mjs')), '缺失')
check('tsconfig.json', existsSync(join(ROOT, 'tsconfig.json')), '缺失')
check('.env.example', existsSync(join(ROOT, '.env.example')), '缺失')
check('prisma/schema.prisma', existsSync(join(ROOT, 'prisma', 'schema.prisma')), '缺失')

// === 2. package.json 脚本完整性 ===
console.log('\n[package.json 脚本]')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const requiredScripts = ['dev', 'build', 'lint', 'typecheck', 'test', 'test:e2e', 'verify:local']
for (const script of requiredScripts) {
  check(`script:${script}`, pkg.scripts && pkg.scripts[script], `缺失脚本 ${script}`)
}

// === 3. 核心依赖完整性 ===
console.log('\n[核心依赖]')
const requiredDeps = [
  'next', 'react', 'react-dom', '@prisma/client', '@tailwindcss/postcss',
  'zod', 'bcryptjs', 'iron-session', 'dotenv'
]
for (const dep of requiredDeps) {
  check(`dep:${dep}`, pkg.dependencies && pkg.dependencies[dep] || pkg.devDependencies && pkg.devDependencies[dep], `缺失依赖 ${dep}`)
}

// === 4. Prisma schema 基本语法检查 ===
console.log('\n[Prisma Schema]')
const schemaContent = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf-8')
check('schema:generator', schemaContent.includes('generator client'), '缺少 generator')
check('schema:datasource', schemaContent.includes('datasource db'), '缺少 datasource')
check('schema:Book', schemaContent.includes('model Book'), '缺少 Book 模型')
check('schema:Chapter', schemaContent.includes('model Chapter'), '缺少 Chapter 模型')
check('schema:StoryBible', schemaContent.includes('model StoryBible'), '缺少 StoryBible 模型')
check('schema:Character', schemaContent.includes('model Character'), '缺少 Character 模型')
check('schema:MemoryItem', schemaContent.includes('model MemoryItem'), '缺少 MemoryItem 模型')
check('schema:Foreshadowing', schemaContent.includes('model Foreshadowing'), '缺少 Foreshadowing 模型')
check('schema:GenerationRun', schemaContent.includes('model GenerationRun'), '缺少 GenerationRun 模型')
check('schema:ChapterVersion', schemaContent.includes('model ChapterVersion'), '缺少 ChapterVersion 模型')
check('schema:User', schemaContent.includes('model User'), '缺少 User 模型')
check('schema:PromptVersion', schemaContent.includes('model PromptVersion'), '缺少 PromptVersion 模型')

// === 5. 核心 AI 模块文件 ===
console.log('\n[AI 模块]')
const aiFiles = [
  'lib/ai/kimiClient.ts',
  'lib/ai/multiModelClient.ts',
  'lib/ai/writeChapter.ts',
  'lib/ai/writeContext.ts',
  'lib/ai/rewriteChapter.ts',
  'lib/ai/rewriteIssue.ts',
  'lib/ai/rewriteSelection.ts',
  'lib/ai/extractMemory.ts',
  'lib/ai/checkConsistency.ts',
  'lib/ai/generateSetting.ts',
  'lib/ai/generateCharacters.ts',
  'lib/ai/generateOutline.ts',
  'lib/ai/generateChapterPlan.ts',
  'lib/ai/generateSummary.ts',
  'lib/ai/contextUtils.ts',
  'lib/ai/repetitionCheck.ts',
  'lib/ai/utils.ts',
  'lib/ai/costEstimator.ts',
]
for (const f of aiFiles) {
  check(`ai:${f}`, existsSync(join(ROOT, f)), '缺失')
}

// === 6. Prompt 模板文件 ===
console.log('\n[Prompt 模板]')
const promptFiles = [
  'lib/ai/prompts/generate_setting.md',
  'lib/ai/prompts/generate_characters.md',
  'lib/ai/prompts/generate_outline.md',
  'lib/ai/prompts/generate_chapter_plan.md',
  'lib/ai/prompts/write_chapter.md',
  'lib/ai/prompts/rewrite_chapter.md',
  'lib/ai/prompts/extract_memory.md',
  'lib/ai/prompts/check_consistency.md',
]
for (const f of promptFiles) {
  check(`prompt:${f}`, existsSync(join(ROOT, f)), '缺失')
}

// === 7. API 路由完整性 ===
console.log('\n[API 路由]')
const apiRoutes = [
  'app/api/books/route.ts',
  'app/api/books/[bookId]/route.ts',
  'app/api/books/[bookId]/setting/generate/route.ts',
  'app/api/books/[bookId]/characters/generate/route.ts',
  'app/api/books/[bookId]/outline/generate/route.ts',
  'app/api/books/[bookId]/chapters/route.ts',
  'app/api/books/[bookId]/chapters/generate-plans/route.ts',
  'app/api/books/[bookId]/chapters/reorder/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/write/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/write-stream/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/write-stream/complete/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/save-final/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/extract-memory/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/check/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/rewrite/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/rewrite-issue/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/rewrite-selection/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/continue/route.ts',
  'app/api/books/[bookId]/chapters/[chapterId]/versions/route.ts',
  'app/api/books/[bookId]/export/route.ts',
  'app/api/books/[bookId]/memory/route.ts',
  'app/api/books/[bookId]/foreshadowings/route.ts',
  'app/api/books/[bookId]/search/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/me/route.ts',
]
for (const f of apiRoutes) {
  check(`api:${f}`, existsSync(join(ROOT, f)), '缺失')
}

// === 8. 页面组件完整性 ===
console.log('\n[页面组件]')
const pages = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/login/page.tsx',
  'app/books/new/page.tsx',
  'app/books/[bookId]/page.tsx',
  'app/books/[bookId]/chapters/[chapterId]/page.tsx',
  'app/books/[bookId]/memory/page.tsx',
  'app/books/[bookId]/export/page.tsx',
]
for (const f of pages) {
  check(`page:${f}`, existsSync(join(ROOT, f)), '缺失')
}

// === 9. 关键组件 ===
console.log('\n[关键组件]')
const components = [
  'components/chapter-actions.tsx',
  'components/chapter-list.tsx',
  'components/rewrite-panel.tsx',
  'components/finalize-button.tsx',
  'components/save-draft-button.tsx',
  'components/continue-panel.tsx',
  'components/chapter-version-history.tsx',
  'components/search-panel.tsx',
  'components/book-actions.tsx',
  'components/toast.tsx',
]
for (const f of components) {
  check(`comp:${f}`, existsSync(join(ROOT, f)), '缺失')
}

// === 10. 数据库和工具文件 ===
console.log('\n[数据库和工具]')
check('lib/db.ts', existsSync(join(ROOT, 'lib', 'db.ts')), '缺失')
check('lib/session.ts', existsSync(join(ROOT, 'lib', 'session.ts')), '缺失')
check('lib/book-config.ts', existsSync(join(ROOT, 'lib', 'book-config.ts')), '缺失')

// === 11. API 路由导出格式检查 ===
console.log('\n[API 路由导出格式]')
function hasExport(filePath, exportName) {
  try {
    const content = readFileSync(join(ROOT, filePath), 'utf-8')
    return content.includes(`export async function ${exportName}`)
  } catch {
    return false
  }
}

check('api:books GET', hasExport('app/api/books/route.ts', 'GET'), '缺少 GET 导出')
check('api:books POST', hasExport('app/api/books/route.ts', 'POST'), '缺少 POST 导出')
check('api:chapters GET', hasExport('app/api/books/[bookId]/chapters/route.ts', 'GET'), '缺少 GET 导出')
check('api:chapters POST', hasExport('app/api/books/[bookId]/chapters/route.ts', 'POST'), '缺少 POST 导出')
check('api:write POST', hasExport('app/api/books/[bookId]/chapters/[chapterId]/write/route.ts', 'POST'), '缺少 POST 导出')
check('api:save-final POST', hasExport('app/api/books/[bookId]/chapters/[chapterId]/save-final/route.ts', 'POST'), '缺少 POST 导出')
check('api:extract-memory POST', hasExport('app/api/books/[bookId]/chapters/[chapterId]/extract-memory/route.ts', 'POST'), '缺少 POST 导出')
check('api:check POST', hasExport('app/api/books/[bookId]/chapters/[chapterId]/check/route.ts', 'POST'), '缺少 POST 导出')

// === 12. .env.example 完整性 ===
console.log('\n[环境变量模板]')
const envContent = readFileSync(join(ROOT, '.env.example'), 'utf-8')
check('env:DATABASE_URL', envContent.includes('DATABASE_URL'), '缺少 DATABASE_URL')
check('env:SESSION_SECRET', envContent.includes('SESSION_SECRET'), '缺少 SESSION_SECRET')
check('env:KIMI_API_KEY', envContent.includes('KIMI_API_KEY'), '缺少 KIMI_API_KEY')

// === 13. next.config.mjs 配置检查 ===
console.log('\n[Next.js 配置]')
const nextConfig = readFileSync(join(ROOT, 'next.config.mjs'), 'utf-8')
check('next:standalone', nextConfig.includes("output: 'standalone'"), '缺少 standalone 输出配置')

// === 14. rewrite-panel 修复确认 ===
console.log('\n[关键修复确认]')
const rewritePanel = readFileSync(join(ROOT, 'components/rewrite-panel.tsx'), 'utf-8')
check('fix:rewrite-panel selector', rewritePanel.includes('textarea[data-editor="main"]'), 'textarea 选择器未修复')
check('fix:rewrite-panel api', rewritePanel.includes('rewrite-selection'), '未使用 rewrite-selection 接口')
check('fix:rewrite-panel range', rewritePanel.includes('selectionRangeRef'), '未添加选区范围记录')

const chapterPage = readFileSync(join(ROOT, 'app/books/[bookId]/chapters/[chapterId]/page.tsx'), 'utf-8')
check('fix:page data-editor', chapterPage.includes('data-editor="main"'), '编辑器未添加 data-editor 标识')

// === 汇总 ===
console.log('\n\n========================================')
console.log(`通过: ${passCount} 项`)
console.log(`错误: ${errors.length} 项`)
console.log(`警告: ${warnings.length} 项`)
console.log('========================================')

if (errors.length > 0) {
  console.log('\n❌ 错误列表:')
  errors.forEach((e) => console.log(`  - ${e}`))
}

if (warnings.length > 0) {
  console.log('\n⚠️ 警告列表:')
  warnings.forEach((w) => console.log(`  - ${w}`))
}

if (errors.length === 0) {
  console.log('\n✅ 代码完整性验证全部通过！')
  process.exit(0)
} else {
  console.log(`\n❌ 代码完整性验证失败，发现 ${errors.length} 个错误`)
  process.exit(1)
}
