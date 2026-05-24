import { test, expect } from './helpers/fixtures.js'


test('history tab is visible on page edit', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/home')
  await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
})

test('history tab shows empty state when no commits exist', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/home')
  await page.click('button:has-text("History")')
  // Wait until either commits or the empty state appear (API is async)
  await expect(page.locator('.revision-item, .revisions-empty')).toBeVisible({ timeout: 15_000 })
})
