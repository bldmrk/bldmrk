import { readFile } from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { MultisiteConfigSchema } from './MultisiteSchema.js'
import type { MultisiteConfig } from './MultisiteSchema.js'
import type { SiteContext } from './SiteContext.js'

export class SiteRegistry {
  private domainMap = new Map<string, SiteContext>()
  private _sites: SiteContext[] = []

  private constructor(config: MultisiteConfig, projectRoot: string) {
    for (const def of config.sites) {
      const siteRoot = def.contentDir
        ? path.isAbsolute(def.contentDir)
          ? def.contentDir
          : path.resolve(projectRoot, def.contentDir)
        : path.join(projectRoot, 'sites', def.domain)

      const ctx: SiteContext = {
        id: def.domain,
        contentDir: path.join(siteRoot, 'content'),
        configDir: siteRoot,
        domain: def.domain,
        aliases: def.aliases,
      }

      this._sites.push(ctx)
      this.domainMap.set(def.domain.toLowerCase(), ctx)
      for (const alias of def.aliases) {
        this.domainMap.set(alias.toLowerCase(), ctx)
      }
    }
  }

  static async load(configPath: string, projectRoot: string): Promise<SiteRegistry> {
    const raw = await readFile(configPath, 'utf-8')
    const parsed = yaml.load(raw)
    const config = MultisiteConfigSchema.parse(parsed)
    return new SiteRegistry(config, projectRoot)
  }

  resolve(host: string): SiteContext | null {
    // Strip port number and lowercase
    const normalized = host.toLowerCase().replace(/:\d+$/, '')
    return this.domainMap.get(normalized) ?? null
  }

  get sites(): SiteContext[] {
    return [...this._sites]
  }
}
