import { test, expect, type Page } from '@playwright/test'

async function createFinalizedChapter(page: Page) {
  await page.goto('/books/new')
  await page.getByPlaceholder('输入小说标题').fill(`中文导出测试小说 ${Date.now()}`)
  await page.getByRole('button', { name: /悬疑推理/ }).click()
  await page
    .getByPlaceholder('例如：一个普通上班族意外获得读取他人情绪的能力')
    .fill('一名编辑发现所有案件都被写进同一本小说。')
  await page.getByRole('button', { name: '创建项目' }).click()
  await page.waitForURL(/\/books\/[0-9a-f-]{36}$/)
  const bookUrl = page.url()

  await page.getByPlaceholder('新章节标题').fill('第一章：空白页')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await expect(page.getByText('第一章：空白页')).toBeVisible()
  await page.getByText('第一章：空白页').click()
  await page.waitForURL(/\/books\/.+\/chapters\/.+/)

  const content = '中文定稿内容，用于验证 Markdown 和 TXT 导出。'
  await page.locator('textarea[data-editor="main"]').fill(content)
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByRole('button', { name: '已保存' })).toBeVisible()

  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '保存定稿' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('已定稿').first()).toBeVisible()

  return { bookUrl, content }
}

test.describe('导出流', () => {
  test('中文标题小说可导出 Markdown 和 TXT', async ({ page }) => {
    const { bookUrl, content } = await createFinalizedChapter(page)

    await page.goto(`${bookUrl}/export`)
    await expect(page.getByRole('heading', { name: '导出小说' })).toBeVisible()

    const markdownDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 Markdown' }).click()
    const markdown = await markdownDownload
    expect(await markdown.failure()).toBeNull()
    expect(markdown.suggestedFilename()).toMatch(/\.md$/)

    const txtDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 TXT' }).click()
    const txt = await txtDownload
    expect(await txt.failure()).toBeNull()
    expect(txt.suggestedFilename()).toMatch(/\.txt$/)

    const markdownPath = await markdown.path()
    const txtPath = await txt.path()
    expect(markdownPath).toBeTruthy()
    expect(txtPath).toBeTruthy()

    const fs = await import('node:fs/promises')
    await expect(fs.readFile(markdownPath!, 'utf8')).resolves.toContain(content)
    await expect(fs.readFile(txtPath!, 'utf8')).resolves.toContain(content)
  })
})
