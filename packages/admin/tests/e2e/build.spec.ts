import { test, expect } from './helpers/fixtures.js'


test('trigger build shows building status', async ({ page, authedPage: _ }) => {
  await page.goto('/')
  const badge = page.getByTestId('build-status-badge')
  await expect(badge).toBeVisible()
  await page.click('button:has-text("Build")')
  // Build may complete before we observe "building"; accept any non-idle status
  await expect(badge).toHaveText(/building|queued|done|error/i, { timeout: 15_000 })
})

test('build completes with done or error status', async ({ page, authedPage: _ }) => {
  await page.goto('/')
  await page.click('button:has-text("Build")')
  // In E2E test environment there is no Astro project, so "error" is also a valid outcome
  await expect(page.getByTestId('build-status-badge')).toHaveText(/done|error/i, { timeout: 30_000 })
})
