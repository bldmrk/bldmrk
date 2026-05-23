<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const api = useApi()
const uploading = ref(false)
const error = ref<string | null>(null)

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  error.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.upload<{ url: string }>('/api/media/upload', formData)
    emit('update:modelValue', res.url)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="modelValue" class="flex items-center gap-3 text-sm">
      <a :href="modelValue" target="_blank" class="text-blue-600 hover:underline truncate max-w-xs">{{ modelValue }}</a>
      <button type="button" class="text-xs text-red-500 hover:text-red-700 shrink-0" @click="$emit('update:modelValue', '')">Remove</button>
    </div>
    <label class="flex items-center gap-2 cursor-pointer">
      <span class="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
        {{ uploading ? 'Uploading…' : modelValue ? 'Replace file' : 'Upload file' }}
      </span>
      <input type="file" class="sr-only" :disabled="uploading" @change="onFileChange" />
    </label>
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
