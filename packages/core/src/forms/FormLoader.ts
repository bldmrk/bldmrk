import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { FormBlueprintSchema } from './FormSchema.js'
import type { FormBlueprint } from './FormSchema.js'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export class FormLoader {
  private formsDir: string

  constructor(contentDir: string) {
    this.formsDir = path.join(contentDir, 'forms')
  }

  async loadAll(): Promise<FormBlueprint[]> {
    let entries: string[]
    try {
      entries = await fs.readdir(this.formsDir)
    } catch {
      return []
    }

    const blueprints: FormBlueprint[] = []
    for (const entry of entries) {
      if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        const name = entry.replace(/\.(yaml|yml)$/, '')
        try {
          const blueprint = await this.load(name)
          blueprints.push(blueprint)
        } catch {
          // skip invalid files
        }
      }
    }
    return blueprints
  }

  async load(name: string): Promise<FormBlueprint> {
    // Try .yaml first, then .yml
    const candidates = [
      path.join(this.formsDir, `${name}.yaml`),
      path.join(this.formsDir, `${name}.yml`),
    ]

    let raw: string | null = null
    let filePath = ''
    for (const candidate of candidates) {
      try {
        raw = await fs.readFile(candidate, 'utf-8')
        filePath = candidate
        break
      } catch {
        // try next
      }
    }

    if (raw === null) {
      throw new Error(`Form blueprint not found: ${name}`)
    }

    let parsed: unknown
    try {
      parsed = yaml.load(raw)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Invalid YAML in form blueprint ${filePath}: ${msg}`)
    }

    const result = FormBlueprintSchema.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new Error(`Invalid form blueprint ${name}: ${issues}`)
    }

    return result.data
  }

  async validate(name: string, data: Record<string, unknown>): Promise<ValidationResult> {
    const blueprint = await this.load(name)
    const errors: ValidationError[] = []

    for (const field of blueprint.fields) {
      const value = data[field.name]
      const isEmpty = value === undefined || value === null || value === ''

      if (field.required && isEmpty) {
        errors.push({ field: field.name, message: `${field.label} is required` })
        continue
      }

      if (isEmpty) continue

      const strValue = String(value)

      // Type-specific validation
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(strValue)) {
          errors.push({ field: field.name, message: `${field.label} must be a valid email address` })
        }
      }

      if (field.validation) {
        const { min, max, pattern } = field.validation

        if (min !== undefined && strValue.length < min) {
          errors.push({ field: field.name, message: `${field.label} must be at least ${min} characters` })
        }

        if (max !== undefined && strValue.length > max) {
          errors.push({ field: field.name, message: `${field.label} must be at most ${max} characters` })
        }

        if (pattern !== undefined) {
          const regex = new RegExp(pattern)
          if (!regex.test(strValue)) {
            errors.push({ field: field.name, message: `${field.label} does not match the required pattern` })
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }
}
