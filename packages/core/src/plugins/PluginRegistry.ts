export interface LoadedPlugin {
  name: string
  version: string
  enabled: boolean
}

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>()

  register(plugin: LoadedPlugin): void {
    this.plugins.set(plugin.name, plugin)
  }

  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  isEnabled(name: string): boolean {
    return this.plugins.get(name)?.enabled ?? false
  }
}
