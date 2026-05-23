import { test, expect } from './helpers/fixtures.js'

test.use({ authedPage: undefined })

test('pages list shows fixture pages', async ({ page, authedPage: _ }) => {
  await page.goto('/pages')
  await expect(page.getByText('Home')).toBeVisible()
  await expect(page.getByText('About')).toBeVisible()
})

test('create new page', async ({ page, authedPage: _ }) => {
  await page.goto('/pages')
  await page.click('[data-testid="new-page-btn"]')
  await page.fill('input[placeholder="Title"]', 'E2E Test Page')
  await page.fill('input[placeholder="Slug"]', 'e2e-test-page')
  await page.click('button[type="submit"]')
  await expect(page.getByText('E2E Test Page')).toBeVisible({ timeout: 10_000 })
})

test('edit page title and save', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/home')
  await expect(page.locator('[data-testid="save-page"]')).toBeVisible()
  // Title is editable in the meta tab
  await page.click('button:has-text("Metadata")')
  const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first()
  await titleInput.fill('Home Updated')
  await page.click('[data-testid="save-page"]')
  await expect(page.locator('[data-testid="save-page"]')).toBeDisabled()
})

test('delete page', async ({ page, authedPage: _ }) => {
  await page.goto('/pages/about')
  page.once('dialog', dialog => dialog.accept())
  await page.click('[data-testid="delete-page"]')
  await expect(page).toHaveURL('/pages', { timeout: 10_000 })
})
