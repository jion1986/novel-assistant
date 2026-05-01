import { test, expect, type Page } from '@playwright/test'

async function createBook(page: Page) {
  await page.goto('/books/new')
  await page.getByPlaceholder('输入小说标题').fill(`记忆库测试小说 ${Date.now()}`)
  await page.getByRole('button', { name: /都市异能/ }).click()
  await page
    .getByPlaceholder('例如：一个普通上班族意外获得读取他人情绪的能力')
    .fill('一个编辑能看见剧情漏洞，并把它们记录到记忆库。')
  await page.getByRole('button', { name: '创建项目' }).click()
  await page.waitForURL(/\/books\/[0-9a-f-]{36}$/)
  return page.url()
}

test.describe('记忆库管理流', () => {
  test('新增记忆和伏笔后立即显示', async ({ page }) => {
    const bookUrl = await createBook(page)

    await page.goto(`${bookUrl}/memory`)
    await expect(page.getByRole('heading', { name: '记忆库' })).toBeVisible()

    await page.getByRole('button', { name: '新增', exact: true }).click()
    await page.getByPlaceholder('记忆内容', { exact: true }).fill('主角确认第一章异常来自剧情漏洞。')
    await page.getByRole('button', { name: '保存' }).first().click()
    await expect(page.getByText('主角确认第一章异常来自剧情漏洞。')).toBeVisible()

    await page.getByRole('button', { name: '新增伏笔' }).click()
    await page.getByPlaceholder('伏笔名称').fill('蓝色书签')
    await page.getByPlaceholder('伏笔描述').fill('书签会在关键章节提示被删改的记忆。')
    await page.getByPlaceholder('埋设章节（如：第3章）').fill('第1章')
    await page.getByPlaceholder('回收计划（如：第15章回收）').fill('第3章回收')
    await page
      .locator('input[placeholder="伏笔名称"]')
      .locator('xpath=ancestor::div[contains(@class, "space-y-2")][1]')
      .getByRole('button', { name: '保存' })
      .click()

    await expect(page.getByText('蓝色书签')).toBeVisible()
    await expect(page.getByText('计划: 第3章回收')).toBeVisible()
  })
})
