<script setup lang="ts">
import { useBlueprintList } from '@/composables/useBlueprint.js'

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const { data: blueprints } = useBlueprintList()
</script>

<template>
  <select
    :value="modelValue"
    class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">— Select template —</option>
    <option v-for="name in blueprints?.pages ?? []" :key="name" :value="name">
      {{ name }}
    </option>
  </select>
</template>
