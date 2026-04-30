import { test, expect } from '@playwright/test'

test.describe('认证流', () => {
  test('新用户注册并自动登录', async ({ page }) => {
    const username = `new_user_${Date.now()}`
    const password = 'secure_password_123'

    await page.goto('/login')

    await page.getByRole('button', { name: '注册' }).first().click()
    await page.getByPlaceholder('用户名').fill(username)
    await page.getByPlaceholder('密码').fill(password)
    await page.getByRole('button', { name: '注册' }).last().click()

    await page.waitForURL('http://localhost:3003/')
    await expect(page.getByRole('heading', { name: 'AI 小说助手' })).toBeVisible()
  })

  test('已有用户登录成功', async ({ page }) => {
    // 先注册一个确定存在的用户
    const username = `login_test_${Date.now()}`
    const password = 'test_password'

    await page.goto('/login')
    await page.getByRole('button', { name: '注册' }).first().click()
    await page.getByPlaceholder('用户名').fill(username)
    await page.getByPlaceholder('密码').fill(password)
    await page.getByRole('button', { name: '注册' }).last().click()
    await page.waitForURL('http://localhost:3003/')

    // 登出（清除 cookie）
    await page.context().clearCookies()

    // 重新登录
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill(username)
    await page.getByPlaceholder('密码').fill(password)
    await page.getByRole('button', { name: '登录' }).last().click()

    await page.waitForURL('http://localhost:3003/')
    await expect(page.getByRole('heading', { name: 'AI 小说助手' })).toBeVisible()
  })

  test('错误密码登录失败', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('用户名').fill('nonexistent_user_xyz')
    await page.getByPlaceholder('密码').fill('wrong_password')
    await page.getByRole('button', { name: '登录' }).last().click()

    await expect(page.getByText(/失败|错误|不正确/)).toBeVisible()
    expect(page.url()).toContain('/login')
  })

  test('未登录用户访问首页被重定向到登录页', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForURL('http://localhost:3003/login')
    await expect(page.getByRole('button', { name: '登录' }).first()).toBeVisible()
  })
})
