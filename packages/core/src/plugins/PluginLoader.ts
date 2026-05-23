import { readFile, writeFile } from 'fs/promises'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'
import path from 'path'
import type { BldmrkAPI, BldmrkPlugin } from './types.js'
import { isBldmrkPlugin } from './types.js'
import type { PluginRegistry } from './PluginRegistry.js'

type ImportFn = (pkg: string) => Promise<{ default: unknown }>

export class PluginLoader {
  private readonly pluginsFile: string

  constructor(
    private readonly configDir: string,
    private readonly api: BldmrkAPI,
    private readonly registry: PluginRegistry,
    private readonly importFn: ImportFn = (pkg) => import(pkg),
  ) {
    this.pluginsFile = path.join(configDir, 'plugins.yaml')
  }

  async load(): Promise<void> {
    const names = await this.readPluginNames()
    for (const name of names) {
      await this.loadOne(name)
    }
  }

  private async loadOne(name: string): Promise<void> {
    let mod: { default: unknown }
    try {
      mod = await this.importFn(name)
    } catch (err) {
      console.error(`[PluginLoader] Failed to import "${name}":`, err)
      return
    }
    const plugin = mod.default
    if (!isBldmrkPlugin(plugin)) {
      console.error(`[PluginLoader] "${name}" does not export a valid BldmrkPlugin`)
      return
    }
    try {
      await plugin.setup(this.api)
      this.registry.register({ name: plugin.name, version: plugin.version, enabled: true })
      await this.api.hooks.emit('plugin:register', { name: plugin.name, version: plugin.version })
    } catch (err) {
      console.error(`[PluginLoader] setup() failed for "${name}":`, err)
    }
  }

  async readPluginNames(): Promise<string[]> {
    try {
      const raw = await readFile(this.pluginsFile, 'utf-8')
      const parsed = parseYaml(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((v): v is string => typeof v === 'string')
    } catch {
      return []
    }
  }

  async addPlugin(name: string): Promise<void> {
    const names = await this.readPluginNames()
    if (!names.includes(name)) {
      await writeFile(this.pluginsFile, dumpYaml([...names, name]), 'utf-8')
    }
  }

  async removePlugin(name: string): Promise<void> {
    const names = await this.readPluginNames()
    await writeFile(this.pluginsFile, dumpYaml(names.filter(n => n !== name)), 'utf-8')
  }
}
