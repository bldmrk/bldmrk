import type { BldmrkAPI, BldmrkHooks, SubmitHandler } from './types.js'
import type { HookSystem } from './HookSystem.js'
import type { FormBlueprint } from '../forms/FormSchema.js'
import type { FlexEntry } from '../flex/FlexSchema.js'
import type { FlexLoader } from '../flex/FlexLoader.js'

export class PluginAPIImpl implements BldmrkAPI {
  private _registeredForms: FormBlueprint[] = []
  private _submitHandlers = new Map<string, SubmitHandler[]>()
  private _flexLoader: FlexLoader | null = null

  constructor(public readonly hooks: HookSystem<BldmrkHooks>) {}

  readonly forms = {
    register: (blueprint: FormBlueprint): void => {
      this._registeredForms.push(blueprint)
    },
    onSubmit: (formName: string, handler: SubmitHandler): void => {
      const handlers = this._submitHandlers.get(formName) ?? []
      handlers.push(handler)
      this._submitHandlers.set(formName, handlers)
    },
  }

  readonly flex = {
    getEntries: (typeName: string): Promise<FlexEntry[]> => {
      if (!this._flexLoader) {
        return Promise.resolve([])
      }
      return this._flexLoader.loadEntries(typeName)
    },
    getEntry: (typeName: string, id: string): Promise<FlexEntry> => {
      if (!this._flexLoader) {
        return Promise.reject(new Error('FlexLoader not initialized'))
      }
      return this._flexLoader.loadEntry(typeName, id)
    },
  }

  setFlexLoader(flexLoader: FlexLoader): void {
    this._flexLoader = flexLoader
  }

  getRegisteredForms(): FormBlueprint[] {
    return [...this._registeredForms]
  }

  getSubmitHandlers(formName: string): SubmitHandler[] {
    return this._submitHandlers.get(formName) ?? []
  }
}
