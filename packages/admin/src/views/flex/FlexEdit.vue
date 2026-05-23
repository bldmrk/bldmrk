<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFlexTypes, useFlexEntry, useFlexMutations } from '@/composables/useFlex.js'
import type { FlexType, FlexValidationError } from '@/composables/useFlex.js'
import type { BlueprintDefinition } from '@/composables/useBlueprint.js'
import BlueprintForm from '@/components/blueprint/BlueprintForm.vue'
import { useMediaStore } from '@/stores/media.js'
import { ApiError } from '@/composables/useApi.js'

const props = defineProps<{ type: string; id?: string }>()

const isNew = computed(() => !props.id || props.id === 'new')
const router = useRouter()
const mediaStore = useMediaStore()

const { data: types } = useFlexTypes()
const entryQuery = useFlexEntry(props.type, isNew.value ? '' : (props.id ?? ''))
const { createEntry, updateEntry } = useFlexMutations(props.type)

const flexType = computed<FlexType | undefined>(() =>
  types.value?.find(t => t.name === props.type),
)

const blueprint = computed<BlueprintDefinition | undefined>(() => {
  if (!flexType.value) return undefined
  return {
    name: flexType.value.name,
    label: flexType.value.label,
    fields: flexType.value.fields,
  }
})

const formData = ref<Record<string, unknown>>({})
const fieldErrors = ref<Record<string, string>>({})
const saving = ref(false)
const globalError = ref<string | null>(null)

function initForm(type: FlexType, data?: Record<string, unknown>) {
  const initial: Record<string, unknown> = {}
  for (const field of type.fields) {
    if (data && field.name in data) {
      initial[field.name] = data[field.name]
    } else if (field.default !== undefined) {
      initial[field.name] = field.default
    } else if (field.type === 'boolean') {
      initial[field.name] = false
    } else if (field.type === 'number') {
      initial[field.name] = null
    } else if (field.type === 'tags' || field.type === 'list') {
      initial[field.name] = []
    } else {
      initial[field.name] = ''
    }
  }
  formData.value = initial
}

watch(
  [flexType, () => entryQuery.data.value],
  ([type, entry]) => {
    if (type) initForm(type, isNew.value ? undefined : (entry?.data ?? {}))
  },
  { immediate: true },
)

onMounted(() => { void mediaStore.loadMedia() })

function validateAll(): boolean {
  const errors: Record<string, string> = {}
  for (const field of flexType.value?.fields ?? []) {
    const value = formData.value[field.name]
    const isEmpty = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (field.required && isEmpty) {
      errors[field.name] = `${field.label} is required`
    }
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSave() {
  if (!flexType.value || !validateAll()) return

  saving.value = true
  globalError.value = null

  const payload: Record<string, unknown> = {}
  for (const field of flexType.value.fields) {
    const raw = formData.value[field.name]
    if (field.type === 'number') {
      payload[field.name] = raw === '' || raw === null ? null : Number(raw)
    } else if (field.type === 'boolean') {
      payload[field.name] = Boolean(raw)
    } else {
      payload[field.name] = raw
    }
  }

  try {
    if (isNew.value) {
      const entry = await createEntry.mutateAsync(payload)
      void router.push(`/flex/${props.type}/${entry.id}`)
    } else {
      await updateEntry.mutateAsync({ id: props.id!, data: payload })
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      try {
        const parsed = JSON.parse(err.message) as { errors?: FlexValidationError[] }
        if (parsed.errors) {
          const map: Record<string, string> = {}
          for (const e of parsed.errors) { map[e.field] = e.message }
          fieldErrors.value = { ...fieldErrors.value, ...map }
          return
        }
      } catch { /* fall through */ }
    }
    globalError.value = err instanceof Error ? err.message : 'An error occurred'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-2xl space-y-6">
    <div class="flex items-center gap-4">
      <button class="text-sm text-gray-500 hover:text-gray-700" @click="router.push(`/flex/${type}`)">← Back</button>
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isNew ? 'New' : 'Edit' }} {{ flexType?.label ?? type }}
      </h1>
    </div>

    <div v-if="!blueprint" class="text-sm text-gray-400">Loading schema…</div>

    <form v-else class="space-y-5" @submit.prevent="handleSave">
      <BlueprintForm
        :blueprint="blueprint"
        :model-value="formData"
        :errors="fieldErrors"
        @update:model-value="formData = $event"
      />

      <p v-if="globalError" class="text-sm text-red-600" role="alert">{{ globalError }}</p>

      <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="submit"
          :disabled="saving"
          class="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
          @click="router.push(`/flex/${type}`)"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
