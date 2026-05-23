<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface SearchResult {
  slug: string
  title: string
  url: string
  excerpt?: string
}

const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'

const query = ref('')
const results = ref<SearchResult[]>([])
const open = ref(false)
const loading = ref(false)
const containerRef = ref<HTMLElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  query.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!value.trim()) {
    results.value = []
    open.value = false
    return
  }
  debounceTimer = setTimeout(() => void doSearch(value), 300)
}

async function doSearch(q: string) {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      results.value = await res.json()
      open.value = results.value.length > 0
    } else {
      results.value = []
      open.value = false
    }
  } catch {
    results.value = []
    open.value = false
  } finally {
    loading.value = false
  }
}

function close() {
  open.value = false
  query.value = ''
  results.value = []
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onClickOutside)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <div class="relative">
      <input
        type="search"
        :value="query"
        placeholder="Search..."
        class="w-48 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:w-64 transition-all"
        aria-label="Search"
        @input="onInput"
      />
      <span v-if="loading" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">…</span>
    </div>

    <!-- Dropdown results -->
    <div
      v-if="open && results.length > 0"
      class="absolute right-0 top-full mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg z-50 max-h-80 overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      <a
        v-for="result in results"
        :key="result.slug"
        :href="result.url"
        class="block px-4 py-2.5 hover:bg-gray-50 no-underline border-b border-gray-100 last:border-0"
        role="option"
        @click="close"
      >
        <p class="text-sm font-medium text-gray-900 m-0">{{ result.title }}</p>
        <p v-if="result.excerpt" class="text-xs text-gray-500 m-0 mt-0.5 line-clamp-1">{{ result.excerpt }}</p>
      </a>
    </div>
  </div>
</template>
