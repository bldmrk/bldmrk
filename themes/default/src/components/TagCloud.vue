<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface TaxonomyEntry {
  value: string
  count: number
  slug: string
}

const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'

const tags = ref<TaxonomyEntry[]>([])
const loading = ref(true)
const error = ref(false)

onMounted(async () => {
  try {
    const res = await fetch(`${API_URL}/api/taxonomy/tags`)
    if (res.ok) {
      tags.value = await res.json()
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

const minCount = computed(() => Math.min(...tags.value.map(t => t.count)))
const maxCount = computed(() => Math.max(...tags.value.map(t => t.count)))

function fontSize(count: number): string {
  const min = minCount.value
  const max = maxCount.value
  if (max === min) return '1rem'
  // Normalize to 5 steps: 0.8rem, 0.95rem, 1.1rem, 1.3rem, 1.6rem
  const sizes = ['0.8rem', '0.95rem', '1.1rem', '1.3rem', '1.6rem']
  const ratio = (count - min) / (max - min)
  const step = Math.min(Math.floor(ratio * 5), 4)
  return sizes[step]!
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-sm text-gray-400">Loading tags...</div>
    <div v-else-if="error" class="text-sm text-gray-400">Could not load tags.</div>
    <div
      v-else-if="tags.length > 0"
      class="flex flex-wrap gap-2 items-baseline"
      aria-label="Tag cloud"
    >
      <a
        v-for="tag in tags"
        :key="tag.slug"
        :href="`/tags/${tag.slug}`"
        class="no-underline text-gray-600 hover:text-[var(--color-primary)] transition-colors px-1 py-0.5 rounded hover:bg-gray-100"
        :style="{ fontSize: fontSize(tag.count) }"
        :aria-label="`${tag.value} (${tag.count} page${tag.count !== 1 ? 's' : ''})`"
        :title="`${tag.count} page${tag.count !== 1 ? 's' : ''}`"
      >
        #{{ tag.value }}
      </a>
    </div>
    <div v-else class="text-sm text-gray-400">No tags yet.</div>
  </div>
</template>
