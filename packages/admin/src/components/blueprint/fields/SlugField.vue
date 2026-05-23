<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  source?: string
  formData?: Record<string, unknown>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function slugify(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const sourceValue = computed(() =>
  props.source && props.formData ? String(props.formData[props.source] ?? '') : '',
)

function autoGenerate() {
  emit('update:modelValue', slugify(sourceValue.value))
}
</script>

<template>
  <div class="flex gap-2">
    <input
      :value="modelValue"
      type="text"
      class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="source"
      type="button"
      class="px-3 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50 whitespace-nowrap"
      :disabled="!sourceValue"
      @click="autoGenerate"
    >
      Auto-generate
    </button>
  </div>
</template>
