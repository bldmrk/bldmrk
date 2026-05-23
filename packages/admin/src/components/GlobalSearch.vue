<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

interface SearchResult {
  slug: string
  title: string
  excerpt: string
  score: number
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const router = useRouter()

const open = ref(false)
const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function openOverlay() {
  open.value = true
  query.value = ''
  results.value = []
}

function closeOverlay() {
  open.value = false
  query.value = ''
  results.value = []
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

async function doSearch(q: string) {
  if (!q.trim()) {
    results.value = []
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      results.value = await res.json()
    } else {
      results.value = []
    }
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  query.value = value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void doSearch(value), 300)
}

function navigateToPage(slug: string) {
  void router.push(`/pages/${slug}/edit`)
  closeOverlay()
}

function onKeydown(e: KeyboardEvent) {
  // Ctrl+K / Cmd+K to open
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    if (open.value) {
      closeOverlay()
    } else {
      openOverlay()
    }
    return
  }
  if (e.key === 'Escape' && open.value) {
    closeOverlay()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <!-- Trigger hint -->
  <div v-if="!open" class="hidden" aria-hidden="true" />

  <!-- Overlay -->
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search pages"
      @click.self="closeOverlay"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="closeOverlay" />

      <!-- Modal panel -->
      <div class="relative w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl">
        <!-- Search input -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="search"
            :value="query"
            placeholder="Search pages…"
            class="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            aria-label="Search query"
            autofocus
            @input="onInput"
            @keydown.escape="closeOverlay"
          />
          <span v-if="loading" class="text-xs text-gray-400">…</span>
          <kbd class="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 bg-gray-100 rounded border border-gray-200">Esc</kbd>
        </div>

        <!-- Results list -->
        <ul v-if="results.length > 0" class="max-h-80 overflow-y-auto divide-y divide-gray-50" role="listbox">
          <li
            v-for="result in results"
            :key="result.slug"
            class="flex flex-col gap-0.5 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
            role="option"
            tabindex="0"
            @click="navigateToPage(result.slug)"
            @keydown.enter="navigateToPage(result.slug)"
          >
            <span class="text-sm font-medium text-gray-900">{{ result.title }}</span>
            <span class="text-xs text-gray-400">{{ result.slug }}</span>
            <span v-if="result.excerpt" class="text-xs text-gray-500 line-clamp-1 mt-0.5">{{ result.excerpt }}</span>
          </li>
        </ul>

        <!-- Empty state -->
        <div
          v-else-if="query.trim() && !loading"
          class="px-4 py-6 text-center text-sm text-gray-400"
        >
          No pages found for &ldquo;{{ query }}&rdquo;
        </div>

        <!-- Footer hint -->
        <div class="flex items-center gap-3 px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          <span><kbd class="font-mono">Enter</kbd> to open</span>
          <span><kbd class="font-mono">Esc</kbd> to close</span>
          <span class="ml-auto"><kbd class="font-mono">Ctrl+K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
