import { defineCommand } from 'citty'
import { consola } from 'consola'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'

const execFileAsync = promisify(execFile)

function getPluginsConfigPath(): string {
  return path.join(process.cwd(), 'content', 'config', 'plugins.yaml')
}

async function readPluginsList(): Promise<string[]> {
  try {
    const content = await readFile(getPluginsConfigPath(), 'utf-8')
    const parsed = loadYaml(content)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

async function writePluginsList(plugins: string[]): Promise<void> {
  await mkdir(path.dirname(getPluginsConfigPath()), { recursive: true })
  await writeFile(getPluginsConfigPath(), dumpYaml(plugins), 'utf-8')
}

export const pluginAddCommand = defineCommand({
  meta: { description: 'Install and register a bldmrk plugin' },
  args: {
    package: { type: 'positional', description: 'npm package name', required: true },
  },
  async run({ args }) {
    const pkg = args.package as string
    consola.start(`Installing ${pkg}...`)
    await execFileAsync('pnpm', ['add', pkg], { cwd: process.cwd() })
    const plugins = await readPluginsList()
    if (!plugins.includes(pkg)) {
      plugins.push(pkg)
      await writePluginsList(plugins)
    }
    consola.success(`Plugin installed: ${pkg}`)
  },
})

export const pluginRemoveCommand = defineCommand({
  meta: { description: 'Remove a bldmrk plugin' },
  args: {
    package: { type: 'positional', description: 'npm package name', required: true },
  },
  async run({ args }) {
    const pkg = args.package as string
    consola.start(`Removing ${pkg}...`)
    await execFileAsync('pnpm', ['remove', pkg], { cwd: process.cwd() })
    const plugins = await readPluginsList()
    await writePluginsList(plugins.filter(p => p !== pkg))
    consola.success(`Plugin removed: ${pkg}`)
  },
})

export const pluginListCommand = defineCommand({
  meta: { description: 'List installed bldmrk plugins' },
  async run() {
    const plugins = await readPluginsList()
    if (plugins.length === 0) {
      consola.info('No plugins installed.')
      return
    }
    console.log('\nInstalled plugins:')
    for (const plugin of plugins) {
      console.log(`  - ${plugin}`)
    }
    console.log()
  },
})
