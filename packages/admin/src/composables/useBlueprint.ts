import { useQuery } from '@tanstack/vue-query'
import { useApi } from './useApi.js'
import type { Ref } from 'vue'

export interface BlueprintField {
  name: string
  type: string
  label: string
  required?: boolean
  default?: unknown
  options?: { value: string; label: string }[]
  fields?: BlueprintField[]
  source?: string
  condition?: { field: string; value: unknown }
  placeholder?: string
  help?: string
}

export interface BlueprintTab {
  id: string
  label: string
  fields: BlueprintField[]
}

export interface BlueprintDefinition {
  name: string
  label: string
  extends?: string
  tabs?: BlueprintTab[]
  fields?: BlueprintField[]
}

export function useBlueprintForPage(template: Ref<string>) {
  const api = useApi()
  return useQuery<BlueprintDefinition>({
    queryKey: ['blueprints', 'pages', template],
    queryFn: () => api.get<BlueprintDefinition>(`/api/blueprints/pages/${template.value}`),
    enabled: () => !!template.value,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBlueprintForConfig(name: string) {
  const api = useApi()
  return useQuery<BlueprintDefinition>({
    queryKey: ['blueprints', 'config', name],
    queryFn: () => api.get<BlueprintDefinition>(`/api/blueprints/config/${name}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useBlueprintList() {
  const api = useApi()
  return useQuery<{ pages: string[]; config: string[] }>({
    queryKey: ['blueprints'],
    queryFn: () => api.get('/api/blueprints'),
    staleTime: 5 * 60 * 1000,
  })
}

export function getFieldsFromBlueprint(blueprint: BlueprintDefinition): BlueprintField[] {
  if (blueprint.fields) return blueprint.fields
  return blueprint.tabs?.flatMap(t => t.fields) ?? []
}
