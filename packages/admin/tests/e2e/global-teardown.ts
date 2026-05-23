import { rm } from 'fs/promises'

export default async function globalTeardown() {
  const tmpDir = process.env.FOLIO_E2E_TMP_DIR
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
}
