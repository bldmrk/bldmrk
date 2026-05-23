import type { PageObject } from '../content/types.js'
import type { FormBlueprint } from '../forms/FormSchema.js'
import type { SubmissionResult } from '../forms/FormSubmissionService.js'
import type { ValidationError } from '../forms/FormLoader.js'
import type { FlexEntry } from '../flex/FlexSchema.js'

export type SubmitHandler = (data: Record<string, unknown>) => void | Promise<void>

export type BldmrkHooks = {
  'page:load':            { path: string }
  'page:before-render':   { page: PageObject }
  'page:after-render':    { page: PageObject; html: string }
  'media:before-upload':  { filename: string; pageId?: string }
  'media:after-upload':   { filename: string; url: string }
  'build:start':          { trigger: 'manual' | 'watch' | 'api' }
  'build:complete':       { duration: number; pages: number; errors: string[] }
  'plugin:register':      { name: string; version: string }
  'search:index':         { pages: PageObject[] }
  'form:before-submit':   { formName: string; data: Record<string, unknown> }
  'form:after-submit':    { formName: string; data: Record<string, unknown>; result: SubmissionResult }
  'form:validate':        { formName: string; data: Record<string, unknown>; errors: ValidationError[] }
  'flex:before-save':     { typeName: string; id: string; data: Record<string, unknown> }
  'flex:after-save':      { typeName: string; id: string; data: Record<string, unknown> }
  'flex:before-delete':   { typeName: string; id: string }
}

export interface BldmrkAPI {
  hooks: import('./HookSystem.js').HookSystem<BldmrkHooks>
  forms: {
    register(blueprint: FormBlueprint): void
    onSubmit(formName: string, handler: SubmitHandler): void
  }
  flex: {
    getEntries(typeName: string): Promise<FlexEntry[]>
    getEntry(typeName: string, id: string): Promise<FlexEntry>
  }
}

export interface BldmrkPlugin {
  name: string
  version: string
  setup(api: BldmrkAPI): void | Promise<void>
}

export function isBldmrkPlugin(v: unknown): v is BldmrkPlugin {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p['name'] === 'string' &&
    typeof p['version'] === 'string' &&
    typeof p['setup'] === 'function'
}
