import { test, expect } from '@playwright/test'

test.describe('章节编辑流', () => {
  async function createBookAndChapter(page: any) {
    // 创建小说
    await page.goto('/books/new')
    await page.getByPlaceholder('输入小说标题').fill('章节测试小说')
    await page.locator('select[name="genre"]').selectOption('玄幻升级')
    await page.getByPlaceholder('例如：一个普通上班族意外获得读取他人情绪的能力').fill('一个少年觉醒系统的故事')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/books\/[a-z0-9-]+/)

    const bookUrl = page.url()
    const bookId = bookUrl.split('/').pop()

    // 创建章节
    await page.getByPlaceholder('新章节标题').fill('第一章：觉醒')
    await page.getByRole('button', { name: '新增' }).click()

    // 等待章节出现在列表中
    await expect(page.getByText('第一章：觉醒')).toBeVisible()

    // 点击章节进入编辑页
    await page.getByText('第一章：觉醒').click()
    await page.waitForURL(/\/books\/.+\/chapters\/.+/)

    return { bookId, chapterId: page.url().split('/').pop() }
  }

  test('创建章节并编辑内容', async ({ page }) => {
    await createBookAndChapter(page)

    // 编辑正文
    const textarea = page.locator('textarea').first()
    await textarea.fill('这是测试章节内容。')
    await expect(textarea).toHaveValue('这是测试章节内容。')

    // 等待自动保存
    await page.waitForTimeout(3500)
    await expect(page.getByText(/已保存|saved/)).toBeVisible()
  })

  test('编辑章节标题', async ({ page }) => {
    await createBookAndChapter(page)

    // 点击标题进入编辑模式
    await page.getByRole('heading', { name: /第\d+章/ }).click()
    const titleInput = page.locator('input[value*="觉醒"]')
    await titleInput.fill('第一章：系统觉醒')
    await page.getByTestId('save-title-btn').click()

    await expect(page.getByRole('heading', { name: '第一章：系统觉醒' })).toBeVisible()
  })

  test('添加本章目标和大纲', async ({ page }) => {
    await createBookAndChapter(page)

    // 点击添加目标/大纲
    await page.getByTestId('edit-meta-btn').click()

    await page.getByTestId('chapter-goal-input').fill('主角获得系统')
    await page.getByTestId('chapter-outline-input').fill('1. 觉醒场景\n2. 获得能力')
    await page.getByTestId('save-meta-btn').click()

    await expect(page.getByText('主角获得系统')).toBeVisible()
    await expect(page.getByText('觉醒场景')).toBeVisible()
  })

  test('保存草稿后定稿', async ({ page }) => {
    await createBookAndChapter(page)

    // 输入内容并手动保存草稿
    const textarea = page.locator('textarea').first()
    await textarea.fill('定稿测试内容。')

    // 按 Ctrl+S 保存草稿
    await textarea.press('Control+s')
    await page.waitForTimeout(1000)

    // 点击定稿按钮（处理 confirm 对话框）
    page.on('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '保存定稿' }).click()

    // 定稿成功后会刷新页面
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('已定稿').first()).toBeVisible()
  })
})
