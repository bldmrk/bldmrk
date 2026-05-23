import { computed } from 'vue'
import type { Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'

export interface FlexFieldOption {
  value: string
  label: string
}

export interface FlexField {
  name: string
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'image' | 'select' | 'list' | 'object'
  label: string
  required: boolean
  default?: unknown
  options?: FlexFieldOption[]
  fields?: FlexField[]
}

export interface FlexType {
  name: string
  label: string
  labelField: string
  icon?: string
  public: boolean
  fields: FlexField[]
  admin?: {
    list?: string[]
    sort?: string
  }
}

export interface FlexEntry {
  id: string
  typeName: string
  data: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface FlexValidationError {
  field: string
  message: string
}

export function useFlexTypes() {
  const api = useApi()
  return useQuery<FlexType[]>({
    queryKey: ['flex-types'],
    queryFn: () => api.get<FlexType[]>('/api/flex'),
  })
}

export function useFlexEntries(typeName: Ref<string> | string) {
  const api = useApi()
  const typeNameRef = typeof typeName === 'string' ? { value: typeName } : typeName

  return useQuery<FlexEntry[]>({
    queryKey: computed(() => ['flex-entries', typeNameRef.value]),
    queryFn: () => api.get<FlexEntry[]>(`/api/flex/${encodeURIComponent(typeNameRef.value)}`),
    enabled: computed(() => !!typeNameRef.value),
  })
}

export function useFlexEntry(typeName: string, id: string) {
  const api = useApi()
  return useQuery<FlexEntry>({
    queryKey: ['flex-entry', typeName, id],
    queryFn: () => api.get<FlexEntry>(`/api/flex/${encodeURIComponent(typeName)}/${encodeURIComponent(id)}`),
    enabled: !!typeName && !!id,
  })
}

export function useFlexMutations(typeName: string) {
  const api = useApi()
  const queryClient = useQueryClient()

  const createEntry = useMutation<FlexEntry, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      api.post<FlexEntry>(`/api/flex/${encodeURIComponent(typeName)}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flex-entries', typeName] })
    },
  })

  const updateEntry = useMutation<FlexEntry, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) =>
      api.put<FlexEntry>(`/api/flex/${encodeURIComponent(typeName)}/${encodeURIComponent(id)}`, data),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['flex-entries', typeName] })
      void queryClient.invalidateQueries({ queryKey: ['flex-entry', typeName, id] })
    },
  })

  const deleteEntry = useMutation<void, Error, string>({
    mutationFn: (id) =>
      api.del(`/api/flex/${encodeURIComponent(typeName)}/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flex-entries', typeName] })
    },
  })

  return { createEntry, updateEntry, deleteEntry }
}
