import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { BlueprintDefinitionSchema, type BlueprintDefinition, type BlueprintTab } from './BlueprintSchema.js'

export function getCoreBlueprintsDir(): string {
  const thisFile = fileURLToPath(import.meta.url)
  return path.join(path.dirname(thisFile), '..', 'blueprints')
}

export class BlueprintEngine {
  constructor(
    private coreDir: string,
    private userDir?: string,
  ) {}

  async resolve(scope: 'pages' | 'config', name: string): Promise<BlueprintDefinition> {
    if (this.userDir) {
      const userPath = path.join(this.userDir, scope, `${name}.yaml`)
      const userRaw = await this._tryReadFile(userPath)
      if (userRaw !== null) {
        const blueprint = this._parse(userRaw, userPath)
        return blueprint.extends ? this._applyExtends(blueprint, scope) : blueprint
      }
    }

    const corePath = path.join(this.coreDir, scope, `${name}.yaml`)
    const coreRaw = await this._tryReadFile(corePath)
    if (coreRaw === null) {
      throw new Error(`Blueprint not found: ${scope}/${name}`)
    }
    const blueprint = this._parse(coreRaw, corePath)
    return blueprint.extends ? this._applyExtends(blueprint, scope) : blueprint
  }

  async list(scope: 'pages' | 'config'): Promise<string[]> {
    const names = new Set<string>()

    const coreScope = path.join(this.coreDir, scope)
    try {
      const files = await fs.readdir(coreScope)
      for (const f of files) {
        if (f.endsWith('.yaml') || f.endsWith('.yml')) {
          names.add(f.replace(/\.(yaml|yml)$/, ''))
        }
      }
    } catch { /* no core blueprints for this scope */ }

    if (this.userDir) {
      const userScope = path.join(this.userDir, scope)
      try {
        const files = await fs.readdir(userScope)
        for (const f of files) {
          if (f.endsWith('.yaml') || f.endsWith('.yml')) {
            names.add(f.replace(/\.(yaml|yml)$/, ''))
          }
        }
      } catch { /* no user blueprints for this scope */ }
    }

    return [...names].sort()
  }

  private async _applyExtends(child: BlueprintDefinition, scope: 'pages' | 'config'): Promise<BlueprintDefinition> {
    const parentName = child.extends!
    const corePath = path.join(this.coreDir, scope, `${parentName}.yaml`)
    const raw = await this._tryReadFile(corePath)
    if (raw === null) {
      throw new Error(`Blueprint extends "${parentName}" but core blueprint not found`)
    }
    const parent = this._parse(raw, corePath)
    const resolvedParent = parent.extends ? await this._applyExtends(parent, scope) : parent
    return this._merge(resolvedParent, child)
  }

  private _merge(parent: BlueprintDefinition, child: BlueprintDefinition): BlueprintDefinition {
    const { extends: _ext, ...childRest } = child
    if (!parent.tabs || !child.tabs) {
      return { ...parent, ...childRest }
    }

    const merged: BlueprintTab[] = []
    const childTabMap = new Map(child.tabs.map(t => [t.id, t]))

    for (const parentTab of parent.tabs) {
      merged.push(childTabMap.get(parentTab.id) ?? parentTab)
    }
    for (const childTab of child.tabs) {
      if (!parent.tabs.find(t => t.id === childTab.id)) {
        merged.push(childTab)
      }
    }

    return { ...parent, ...childRest, tabs: merged }
  }

  private _parse(raw: string, filePath: string): BlueprintDefinition {
    const parsed = yaml.load(raw)
    const result = BlueprintDefinitionSchema.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Invalid blueprint at ${filePath}: ${issues}`)
    }
    return result.data
  }

  private async _tryReadFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  }
}
