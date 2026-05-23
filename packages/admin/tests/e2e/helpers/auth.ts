import type { Page } from '@playwright/test'

export const TEST_EMAIL = 'admin@test.com'
export const TEST_PASSWORD = 'test1234'

export async function loginAs(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login')
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}
