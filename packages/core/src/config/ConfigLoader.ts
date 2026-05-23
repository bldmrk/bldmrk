import { readFile, writeFile } from 'fs/promises'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'
import { z } from 'zod'
import { ConfigValidationError } from './errors.js'
import {
  SiteConfigSchema,
  SystemConfigSchema,
  type SiteConfig,
  type SystemConfig,
} from './ConfigSchema.js'

export class ConfigLoader {
  async load(configDir: string): Promise<{ site: SiteConfig; system: SystemConfig }> {
    const site = await this.loadFile(configDir, 'site.yaml', SiteConfigSchema, 'site')
    const system = await this.loadFile(configDir, 'system.yaml', SystemConfigSchema, 'system')
    return { site, system }
  }

  private async loadFile<T>(
    configDir: string,
    filename: string,
    schema: z.ZodType<T>,
    pathPrefix: string,
  ): Promise<T> {
    let raw: unknown = {}
    try {
      const content = await readFile(`${configDir}/${filename}`, 'utf-8')
      raw = (parseYaml(content) as unknown) ?? {}
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    const result = schema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      const fieldPath = issue.path.length > 0
        ? `${pathPrefix}.${issue.path.join('.')}`
        : pathPrefix
      throw new ConfigValidationError(fieldPath, issue.message)
    }
    return result.data
  }

  async saveSite(configDir: string, data: unknown): Promise<SiteConfig> {
    const result = SiteConfigSchema.safeParse(data)
    if (!result.success) throw new ConfigValidationError('site', result.error.issues[0].message)
    await writeFile(`${configDir}/site.yaml`, dumpYaml(result.data), 'utf-8')
    return result.data
  }

  async saveSystem(configDir: string, data: unknown): Promise<SystemConfig> {
    const result = SystemConfigSchema.safeParse(data)
    if (!result.success) throw new ConfigValidationError('system', result.error.issues[0].message)
    await writeFile(`${configDir}/system.yaml`, dumpYaml(result.data), 'utf-8')
    return result.data
  }
}
