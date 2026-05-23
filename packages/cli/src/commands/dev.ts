import { defineCommand } from 'citty'
import { consola } from 'consola'
import { spawn } from 'child_process'
import { loadAppConfig } from '../lib/config.js'
import { createApp } from '@bldmrk/core'

export const devCommand = defineCommand({
  meta: { description: 'Start the CMS API server and admin dev server' },
  async run() {
    consola.start('Starting bldmrk dev environment...')

    const config = await loadAppConfig()

    const adminProc = spawn('pnpm', ['--filter', '@bldmrk/admin', 'dev'], {
      stdio: 'inherit',
      shell: false,
    })
    adminProc.on('error', (err: Error) => consola.warn('Admin dev server error:', err.message))

    let app: Awaited<ReturnType<typeof createApp>> | undefined

    const shutdown = async () => {
      if (adminProc) adminProc.kill('SIGTERM')
      await app?.close()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    try {
      app = await createApp(config)
      await app.listen({ port: config.port, host: '0.0.0.0' })
    } catch (err) {
      consola.error('[bldmrk] Fatal: server failed to start', err)
      process.exit(1)
    }
    consola.success(`API server running on http://localhost:${config.port}`)
  },
})
