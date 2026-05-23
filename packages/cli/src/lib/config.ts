import path from 'path'
import { ConfigLoader } from '@bldmrk/core'
import { consola } from 'consola'
import type { AppConfig } from '@bldmrk/core'

export async function loadAppConfig(cwd = process.env['BLDMRK_PROJECT_DIR'] ?? process.cwd()): Promise<AppConfig> {
  const configDir = path.join(cwd, 'content', 'config')
  const contentDir = path.join(cwd, 'content')
  const loader = new ConfigLoader()
  const { system } = await loader.load(configDir)
  const jwtSecret = process.env['BLDMRK_JWT_SECRET'] ?? 'dev-secret-change-in-production!!'
  if (!process.env['BLDMRK_JWT_SECRET']) {
    consola.warn('BLDMRK_JWT_SECRET not set — using insecure default. Set it in production!')
  }
  return {
    contentDir,
    configDir,
    port: system.port,
    jwtSecret,
    corsOrigins: system.cors.origins,
    projectDir: cwd,
  }
}
