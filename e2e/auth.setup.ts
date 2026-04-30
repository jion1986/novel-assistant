import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('注册并登录测试账号', async ({ page }) => {
  const testUser = `e2e_user_${Date.now()}`
  const testPass = 'e2e_test_password'

  await page.goto('/login')

  // 先注册
  await page.getByRole('button', { name: '注册' }).first().click()
  await page.getByPlaceholder('用户名').fill(testUser)
  await page.getByPlaceholder('密码').fill(testPass)
  await page.getByRole('button', { name: '注册' }).last().click()

  // 等待跳转或错误提示
  await page.waitForTimeout(500)

  // 如果还在登录页，可能是用户已存在，直接登录
  if (page.url().includes('/login')) {
    await page.getByRole('button', { name: '登录' }).first().click()
    await page.getByPlaceholder('用户名').fill(testUser)
    await page.getByPlaceholder('密码').fill(testPass)
    await page.getByRole('button', { name: '登录' }).last().click()
  }

  await page.waitForURL('http://localhost:3003/')
  await expect(page.getByRole('heading', { name: 'AI 小说助手' })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
