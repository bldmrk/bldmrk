import { test, expect } from './helpers/fixtures.js'
import path from 'path'
import { writeFile, mkdir } from 'fs/promises'
import os from 'os'

test.use({ authedPage: undefined })

test('media grid loads', async ({ page, authedPage: _ }) => {
  await page.goto('/media')
  await expect(page.locator('[data-testid="media-upload-input"]')).toBeAttached()
})

test('upload file appears in grid', async ({ page, authedPage: _ }) => {
  // Create a small test PNG in tmp
  const tmpFile = path.join(os.tmpdir(), 'e2e-test.png')
  // 1x1 transparent PNG bytes
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
    'hex'
  )
  await writeFile(tmpFile, png)

  await page.goto('/media')
  await page.locator('[data-testid="media-upload-input"]').setInputFiles(tmpFile)
  await expect(page.getByText('e2e-test.png')).toBeVisible({ timeout: 15_000 })
})

test('delete uploaded file', async ({ page, authedPage: _ }) => {
  await page.goto('/media')
  // Right-click on the first media item to get context menu
  const firstItem = page.locator('.group').first()
  await firstItem.click({ button: 'right' })
  // Accept confirm dialog
  page.once('dialog', dialog => dialog.accept())
  await page.getByText('Delete').click()
  await expect(firstItem).not.toBeVisible({ timeout: 5_000 })
})
