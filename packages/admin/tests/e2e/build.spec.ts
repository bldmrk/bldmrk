import { test, expect } from './helpers/fixtures.js'


test('trigger build shows building status', async ({ page, authedPage: _ }) => {
  await page.goto('/')
  await page.click('button:has-text("Build")')
  await expect(page.locator('[class*="blue"]').filter({ hasText: /building|queued/i })).toBeVisible({ timeout: 10_000 })
})

test('build completes with done status', async ({ page, authedPage: _ }) => {
  await page.goto('/')
  await page.click('button:has-text("Build")')
  await expect(page.locator('[class*="green"]').filter({ hasText: /done/i })).toBeVisible({ timeout: 30_000 })
})
