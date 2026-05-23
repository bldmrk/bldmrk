<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const datePart = computed(() => props.modelValue?.split('T')[0] ?? '')
const timePart = computed(() => props.modelValue?.split('T')[1]?.slice(0, 5) ?? '')

function update(date: string, time: string) {
  emit('update:modelValue', time ? `${date}T${time}:00` : date)
}
</script>

<template>
  <div class="flex gap-2">
    <input
      :value="datePart"
      type="date"
      class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
      @input="update(($event.target as HTMLInputElement).value, timePart)"
    />
    <input
      :value="timePart"
      type="time"
      class="w-32 border border-gray-300 rounded px-3 py-2 text-sm"
      @input="update(datePart, ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
