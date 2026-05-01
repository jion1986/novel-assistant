import { test, expect } from '@playwright/test'

test.describe('书籍管理流', () => {
  test('创建小说项目', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: '新建小说' }).click()
    await page.waitForURL(/\/books\/new/)

    await page.getByPlaceholder('输入小说标题').fill('E2E 测试小说')
    await page.getByRole('button', { name: /科幻未来/ }).click()
    await page.getByPlaceholder('例如：一个普通上班族意外获得读取他人情绪的能力').fill('一个 AI 学会了写小说的故事')
    await page.getByRole('button', { name: '快节奏' }).click()
    await page.getByRole('button', { name: '热血向' }).click()

    await page.getByRole('button', { name: '创建项目' }).click()

    // 创建成功后跳转到书籍详情页
    await page.waitForURL(/\/books\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'E2E 测试小说' })).toBeVisible()
  })

  test('书籍列表显示已创建的小说', async ({ page }) => {
    // 先创建一本书
    await page.goto('/books/new')
    await page.getByPlaceholder('输入小说标题').fill('列表测试小说')
    await page.getByRole('button', { name: /都市异能/ }).click()
    await page.getByPlaceholder('例如：一个普通上班族意外获得读取他人情绪的能力').fill('测试列表显示')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/books\/[0-9a-f-]{36}$/)

    // 返回首页检查列表
    await page.goto('/')
    await expect(page.getByText('列表测试小说')).toBeVisible()
    await expect(page.getByText('都市异能')).toBeVisible()
  })

  test('访问不存在的小说显示错误信息', async ({ page }) => {
    await page.goto('/books/non-existent-id-12345')
    await expect(page.getByText('小说项目不存在')).toBeVisible()
  })
})
