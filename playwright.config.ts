import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bldmrk-e2e-'))
process.env.BLDMRK_E2E_TMP_DIR = tmpDir

// Create directory structure and config files synchronously so the WebServer
// can start before globalSetup runs (Playwright starts webServer first).
const contentDir = path.join(tmpDir, 'content')
const configDir = path.join(contentDir, 'config')
const pagesDir = path.join(contentDir, 'pages')
const mediaDir = path.join(contentDir, 'media')

fs.mkdirSync(configDir, { recursive: true })
fs.mkdirSync(path.join(pagesDir, '001--home'), { recursive: true })
fs.mkdirSync(path.join(pagesDir, '002--about'), { recursive: true })
fs.mkdirSync(mediaDir, { recursive: true })

fs.writeFileSync(path.join(configDir, 'site.yaml'), 'name: E2E Test Site\nurl: http://localhost:5173\n')
fs.writeFileSync(path.join(configDir, 'system.yaml'), 'port: 3000\nadminPath: /admin\nlogLevel: error\ncors:\n  origins: []\n')
fs.writeFileSync(path.join(pagesDir, '001--home', 'index.mdx'), '# Home\n\nWelcome to the E2E test site.\n')
fs.writeFileSync(path.join(pagesDir, '001--home', 'page.yaml'), 'title: Home\ntemplate: default\npublished: true\n')
fs.writeFileSync(path.join(pagesDir, '002--about', 'index.mdx'), '# About\n\nAbout page.\n')
fs.writeFileSync(path.join(pagesDir, '002--about', 'page.yaml'), 'title: About\ntemplate: default\npublished: true\n')

export default defineConfig({
  testDir: './packages/admin/tests/e2e',
  globalSetup: './packages/admin/tests/e2e/global-setup.ts',
  globalTeardown: './packages/admin/tests/e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'node packages/cli/dist/index.js dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      BLDMRK_PROJECT_DIR: tmpDir,
      BLDMRK_JWT_SECRET: 'e2e-test-secret-for-ci-32chars!!',
    },
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
