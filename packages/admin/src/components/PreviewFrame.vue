<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{ slug: string; refreshKey: number }>()

const loading = ref(true)
const src = computed(() => `/api/build/preview?slug=${encodeURIComponent(props.slug)}&_k=${props.refreshKey}`)

watch(() => props.refreshKey, () => { loading.value = true })
</script>

<template>
  <div class="relative h-full w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
      <span class="text-sm text-gray-400">Loading preview…</span>
    </div>
    <iframe
      :src="src"
      class="w-full h-full border-0"
      @load="loading = false"
    />
  </div>
</template>
