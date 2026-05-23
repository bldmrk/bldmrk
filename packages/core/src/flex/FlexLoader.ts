import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { FlexTypeSchema } from './FlexSchema.js'
import type { FlexType, FlexField, FlexEntry } from './FlexSchema.js'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface FlexValidationError {
  field: string
  message: string
}

export class FlexValidationException extends Error {
  constructor(public readonly errors: FlexValidationError[]) {
    super(`Validation failed: ${errors.map(e => e.message).join('; ')}`)
    this.name = 'FlexValidationException'
  }
}

export class FlexLoader {
  private flexDir: string

  constructor(contentDir: string) {
    this.flexDir = path.join(contentDir, 'flex')
  }

  async loadTypes(): Promise<FlexType[]> {
    let typeDirs: string[]
    try {
      typeDirs = await fs.readdir(this.flexDir)
    } catch {
      return []
    }

    const types: FlexType[] = []
    for (const dir of typeDirs) {
      const schemaPath = path.join(this.flexDir, dir, '_schema.yaml')
      try {
        const raw = await fs.readFile(schemaPath, 'utf-8')
        const parsed = yaml.load(raw)
        const result = FlexTypeSchema.safeParse(parsed)
        if (result.success) {
          types.push(result.data)
        }
      } catch {
        // skip invalid / missing schema files
      }
    }
    return types
  }

  async loadType(typeName: string): Promise<FlexType> {
    const schemaPath = path.join(this.flexDir, typeName, '_schema.yaml')
    let raw: string
    try {
      raw = await fs.readFile(schemaPath, 'utf-8')
    } catch {
      throw new Error(`Flex type not found: ${typeName}`)
    }

    const parsed = yaml.load(raw)
    const result = FlexTypeSchema.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Invalid flex schema for ${typeName}: ${issues}`)
    }
    return result.data
  }

  async loadEntries(typeName: string): Promise<FlexEntry[]> {
    const entriesDir = path.join(this.flexDir, typeName, 'entries')
    let files: string[]
    try {
      files = await fs.readdir(entriesDir)
    } catch {
      return []
    }

    const entries: FlexEntry[] = []
    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue
      const id = file.replace(/\.(yaml|yml)$/, '')
      try {
        const entry = await this.loadEntry(typeName, id)
        entries.push(entry)
      } catch {
        // skip unreadable entries
      }
    }
    return entries
  }

  async loadEntry(typeName: string, id: string): Promise<FlexEntry> {
    const filePath = this._entryPath(typeName, id)
    let raw: string
    try {
      raw = await fs.readFile(filePath, 'utf-8')
    } catch {
      throw new Error(`Flex entry not found: ${typeName}/${id}`)
    }

    const parsed = yaml.load(raw) as Record<string, unknown>
    const { _createdAt, _updatedAt, ...data } = parsed ?? {}

    return {
      id,
      typeName,
      data,
      createdAt: _createdAt instanceof Date ? _createdAt : (_createdAt ? new Date(String(_createdAt)) : undefined),
      updatedAt: _updatedAt instanceof Date ? _updatedAt : (_updatedAt ? new Date(String(_updatedAt)) : undefined),
    }
  }

  async saveEntry(typeName: string, id: string, data: Record<string, unknown>): Promise<void> {
    const flexType = await this.loadType(typeName)
    this._validateRequired(flexType.fields, data)

    const entriesDir = path.join(this.flexDir, typeName, 'entries')
    await fs.mkdir(entriesDir, { recursive: true })

    const now = new Date().toISOString()
    let _createdAt: string = now

    // Preserve existing createdAt if file exists
    try {
      const existing = await this.loadEntry(typeName, id)
      _createdAt = existing.createdAt?.toISOString() ?? now
    } catch {
      // new entry — use now
    }

    const fileData = { ...data, _createdAt, _updatedAt: now }
    const content = yaml.dump(fileData)
    await fs.writeFile(this._entryPath(typeName, id), content, 'utf-8')
  }

  async createEntry(typeName: string, data: Record<string, unknown>): Promise<string> {
    const flexType = await this.loadType(typeName)
    this._validateRequired(flexType.fields, data)

    const labelValue = String(data[flexType.labelField] ?? 'entry')
    const baseSlug = slugify(labelValue) || 'entry'

    // Ensure unique ID
    const entriesDir = path.join(this.flexDir, typeName, 'entries')
    let existingFiles: string[] = []
    try {
      existingFiles = await fs.readdir(entriesDir)
    } catch {
      // directory may not exist yet — that's fine
    }

    const existingIds = new Set(existingFiles.map(f => f.replace(/\.(yaml|yml)$/, '')))
    let id = baseSlug
    let counter = 1
    while (existingIds.has(id)) {
      id = `${baseSlug}-${counter++}`
    }

    await this.saveEntry(typeName, id, data)
    return id
  }

  async deleteEntry(typeName: string, id: string): Promise<void> {
    const filePath = this._entryPath(typeName, id)
    try {
      await fs.unlink(filePath)
    } catch {
      throw new Error(`Flex entry not found: ${typeName}/${id}`)
    }
  }

  private _entryPath(typeName: string, id: string): string {
    return path.join(this.flexDir, typeName, 'entries', `${id}.yaml`)
  }

  private _validateRequired(fields: FlexField[], data: Record<string, unknown>): void {
    const errors: FlexValidationError[] = []
    for (const field of fields) {
      if (field.required) {
        const value = data[field.name]
        const isEmpty = value === undefined || value === null || value === ''
        if (isEmpty) {
          errors.push({ field: field.name, message: `${field.label} is required` })
        }
      }
      // Recursively validate nested object fields
      if (field.type === 'object' && field.fields && data[field.name] && typeof data[field.name] === 'object') {
        try {
          this._validateRequired(field.fields, data[field.name] as Record<string, unknown>)
        } catch (e) {
          if (e instanceof FlexValidationException) {
            errors.push(...e.errors)
          }
        }
      }
    }
    if (errors.length > 0) {
      throw new FlexValidationException(errors)
    }
  }
}
