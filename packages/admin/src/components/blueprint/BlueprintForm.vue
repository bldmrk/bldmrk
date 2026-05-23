<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { BlueprintDefinition, BlueprintField } from '@/composables/useBlueprint.js'
import BlueprintFieldComponent from './BlueprintField.vue'

const props = defineProps<{
  blueprint: BlueprintDefinition
  modelValue: Record<string, unknown>
  errors?: Record<string, string>
  activeTab?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
  'update:activeTab': [id: string]
}>()

const localTab = ref(props.activeTab ?? props.blueprint.tabs?.[0]?.id ?? '')

watch(() => props.activeTab, (v) => { if (v) localTab.value = v })
watch(() => props.blueprint.tabs?.[0]?.id, (id) => {
  if (id && !localTab.value) localTab.value = id
})

const currentFields = computed<BlueprintField[]>(() => {
  if (props.blueprint.fields) return props.blueprint.fields
  return props.blueprint.tabs?.find(t => t.id === localTab.value)?.fields ?? []
})

function setTab(id: string) {
  localTab.value = id
  emit('update:activeTab', id)
}

function updateField(name: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}
</script>

<template>
  <div class="space-y-0">
    <!-- Tab bar (only when blueprint has tabs) -->
    <div v-if="blueprint.tabs" class="flex border-b border-gray-200 mb-4">
      <button
        v-for="tab in blueprint.tabs"
        :key="tab.id"
        :class="[
          'px-4 py-2 text-sm transition-colors',
          localTab === tab.id
            ? 'border-b-2 border-gray-900 font-medium text-gray-900'
            : 'text-gray-500 hover:text-gray-700',
        ]"
        type="button"
        @click="setTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Fields -->
    <div class="space-y-5">
      <template v-for="field in currentFields" :key="field.name">
        <BlueprintFieldComponent
          :field="field"
          :model-value="modelValue[field.name]"
          :form-data="modelValue"
          @update:model-value="updateField(field.name, $event)"
        >
          <!-- Section nested fields -->
          <template v-if="field.type === 'section'" #section-fields>
            <BlueprintFieldComponent
              v-for="child in field.fields ?? []"
              :key="child.name"
              :field="child"
              :model-value="modelValue[child.name]"
              :form-data="modelValue"
              @update:model-value="updateField(child.name, $event)"
            />
          </template>
        </BlueprintFieldComponent>

        <!-- Field-level error -->
        <p v-if="errors?.[field.name]" class="text-xs text-red-600 -mt-3" role="alert">
          {{ errors[field.name] }}
        </p>
      </template>
    </div>
  </div>
</template>
