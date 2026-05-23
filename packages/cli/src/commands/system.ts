import { defineCommand } from 'citty'
import { consola } from 'consola'
import { rm } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export const cacheClearCommand = defineCommand({
  meta: { description: 'Clear the .bldmrk-cache/ directory' },
  async run() {
    const cacheDir = path.join(process.cwd(), '.bldmrk-cache')
    await rm(cacheDir, { recursive: true, force: true })
    consola.success('Cache cleared.')
  },
})

export const searchRebuildCommand = defineCommand({
  meta: { description: 'Trigger search index rebuild via API' },
  args: {
    port: { type: 'string', description: 'API port', default: '3000' },
  },
  async run({ args }) {
    const portStr = (args.port as string | undefined) ?? '3000'
    const portNum = parseInt(portStr, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      consola.error('Invalid port number')
      process.exit(1)
    }
    consola.start('Triggering search rebuild...')
    const res = await fetch(`http://localhost:${portNum}/api/search/rebuild`, { method: 'POST' })
    if (res.ok) {
      consola.success('Search index rebuild triggered.')
    } else {
      consola.error(`API returned ${res.status}. Is the dev server running?`)
      process.exit(1)
    }
  },
})

export const upgradeCommand = defineCommand({
  meta: { description: 'Upgrade all @bldmrk/* packages to latest' },
  async run() {
    consola.start('Upgrading @bldmrk/* packages...')
    await execFileAsync('pnpm', ['update', '@bldmrk/*'], { cwd: process.cwd() })
    consola.success('Upgrade complete.')
  },
})
