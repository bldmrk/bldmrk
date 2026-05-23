import { test, expect } from '@playwright/test'
import { loginAs, TEST_EMAIL, TEST_PASSWORD } from './helpers/auth.js'

test('successful login redirects to dashboard', async ({ page }) => {
  await loginAs(page)
  await expect(page).toHaveURL('/')
})

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', TEST_EMAIL)
  await page.fill('[name="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
})

test('unknown email shows error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'nobody@example.com')
  await page.fill('[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
})

test('unauthenticated access redirects to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('logout redirects to login', async ({ page }) => {
  await loginAs(page)
  await page.click('[data-testid="logout-btn"]')
  await expect(page).toHaveURL(/\/login/)
})
