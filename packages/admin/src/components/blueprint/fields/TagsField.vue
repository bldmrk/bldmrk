<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const input = ref('')

function addTag() {
  const tag = input.value.trim()
  if (tag && !props.modelValue.includes(tag)) {
    emit('update:modelValue', [...props.modelValue, tag])
  }
  input.value = ''
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  } else if (e.key === 'Backspace' && !input.value && props.modelValue.length > 0) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded min-h-10 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
    <span
      v-for="tag in modelValue"
      :key="tag"
      class="flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-2 py-0.5 rounded"
    >
      {{ tag }}
      <button type="button" class="text-gray-400 hover:text-gray-700 leading-none" @click="removeTag(tag)">×</button>
    </span>
    <input
      v-model="input"
      type="text"
      placeholder="Add tag…"
      class="flex-1 min-w-24 outline-none text-sm bg-transparent"
      @keydown="onKeydown"
      @blur="addTag"
    />
  </div>
</template>
