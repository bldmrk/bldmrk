import { test, expect } from './helpers/fixtures.js'
import path from 'path'
import { writeFile } from 'fs/promises'
import os from 'os'

// 1x1 transparent PNG
const PNG_HEX =
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082'

async function createTestPng(name: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), name)
  await writeFile(tmpFile, Buffer.from(PNG_HEX, 'hex'))
  return tmpFile
}

test('media grid loads', async ({ page, authedPage: _ }) => {
  await page.goto('/media')
  await expect(page.locator('[data-testid="media-upload-input"]')).toBeAttached()
})

test('upload file appears in grid', async ({ page, authedPage: _ }) => {
  const tmpFile = await createTestPng('e2e-test.png')
  await page.goto('/media')
  await page.locator('[data-testid="media-upload-input"]').setInputFiles(tmpFile)
  await expect(page.getByText('e2e-test.png')).toBeVisible({ timeout: 15_000 })
})

test('delete uploaded file', async ({ page, authedPage: _ }) => {
  const tmpFile = await createTestPng('e2e-delete-test.png')
  await page.goto('/media')
  await page.locator('[data-testid="media-upload-input"]').setInputFiles(tmpFile)
  // After upload, the grid item appears (text is in opacity-0 hover overlay, so check DOM attachment)
  const gridItem = page.locator('.group').filter({ hasText: 'e2e-delete-test.png' })
  await expect(gridItem).toBeAttached({ timeout: 15_000 })

  // Right-click on the uploaded grid item to open context menu
  await gridItem.click({ button: 'right' })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(gridItem).not.toBeAttached({ timeout: 10_000 })
})
