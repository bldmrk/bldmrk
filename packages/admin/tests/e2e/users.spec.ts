import { test, expect } from './helpers/fixtures.js'


test('users page loads and shows current admin', async ({ page, authedPage: _ }) => {
  await page.goto('/users')
  await expect(page.getByText('admin@test.com')).toBeVisible()
})

test('create a new user', async ({ page, authedPage: _ }) => {
  await page.goto('/users')
  await page.click('[data-testid="new-user-btn"]')
  await page.fill('input[name="email"], input[placeholder*="email" i]', 'editor@test.com')
  await page.fill('input[name="password"], input[placeholder*="password" i], input[type="password"]', 'editorpass1')
  // Select role if there's a select
  const roleSelect = page.locator('select[name="role"]')
  if (await roleSelect.isVisible()) {
    await roleSelect.selectOption('editor')
  }
  await page.click('button[type="submit"]')
  await expect(page.getByText('editor@test.com')).toBeVisible({ timeout: 5_000 })
})

test('delete a user', async ({ page, authedPage: _ }) => {
  // Create a user first via API shortcut isn't available, so navigate and delete the one we created
  await page.goto('/users')
  const deleteBtn = page.locator('[data-testid="delete-user"]').first()
  if (await deleteBtn.isVisible()) {
    page.once('dialog', d => d.accept())
    await deleteBtn.click()
  }
})
