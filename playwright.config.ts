import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bldmrk-e2e-'))
process.env.BLDMRK_E2E_TMP_DIR = tmpDir

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
