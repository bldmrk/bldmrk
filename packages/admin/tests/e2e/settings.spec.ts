import { test, expect } from './helpers/fixtures.js'


test('settings loads site tab', async ({ page, authedPage: _ }) => {
  await page.goto('/settings')
  await expect(page.getByText('Site name', { exact: false })).toBeVisible()
})

test('save site title shows success feedback', async ({ page, authedPage: _ }) => {
  await page.goto('/settings')
  const input = page.locator('input').first()
  await input.fill('Updated E2E Site')
  await page.click('[data-testid="settings-save"]')
  await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible()
})

test('saved title persists after reload', async ({ page, authedPage: _ }) => {
  await page.goto('/settings')
  const input = page.locator('input').first()
  await input.fill('Persisted Title')
  await page.click('[data-testid="settings-save"]')
  await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible()
  await page.reload()
  await expect(input).toHaveValue('Persisted Title')
})
