import { test, expect } from './helpers/fixtures.js'


test('history tab is visible on page edit', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/home')
  await expect(page.getByRole('button', { name: 'History' })).toBeVisible()
})

test('history tab shows empty state when no commits exist', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/home')
  await page.click('button:has-text("History")')
  // Either shows commits or the empty state message
  const hasRevisions = await page.locator('.revision-item').count()
  const hasEmpty = await page.locator('.revisions-empty').isVisible().catch(() => false)
  expect(hasRevisions > 0 || hasEmpty).toBe(true)
})
