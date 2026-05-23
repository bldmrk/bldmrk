<script setup lang="ts">
import MdxEditor from '@/components/MdxEditor.vue'

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="h-96 border border-gray-300 rounded overflow-hidden">
    <MdxEditor :model-value="modelValue" class="h-full" @update:model-value="$emit('update:modelValue', $event)" />
  </div>
</template>
