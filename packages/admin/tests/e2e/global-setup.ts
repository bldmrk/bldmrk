import path from 'path'
import { UserStore } from '@bldmrk/core'

// Directory structure and config files are created synchronously in playwright.config.ts
// before the webServer starts. Here we only create the admin user.
export default async function globalSetup() {
  const tmpDir = process.env.BLDMRK_E2E_TMP_DIR
  if (!tmpDir) throw new Error('BLDMRK_E2E_TMP_DIR not set')

  const configDir = path.join(tmpDir, 'content', 'config')
  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test1234', role: 'admin' })
}
