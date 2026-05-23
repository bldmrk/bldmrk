import { defineCommand } from 'citty'
import { consola } from 'consola'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const buildCommand = defineCommand({
  meta: { description: 'Build the static site (Astro SSG)' },
  async run() {
    consola.start('Building static site...')
    await execFileAsync('pnpm', ['build:theme'], { cwd: process.cwd() })
    consola.success('Build complete')
  },
})

export const buildPreviewCommand = defineCommand({
  meta: { description: 'Build Astro SSR for staging preview' },
  async run() {
    consola.start('Building preview...')
    await execFileAsync('pnpm', ['--filter', '@bldmrk/theme-default', 'build:preview'], { cwd: process.cwd() })
    consola.success('Preview build complete')
  },
})
