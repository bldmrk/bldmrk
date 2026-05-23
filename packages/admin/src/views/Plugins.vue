<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi.js'

interface PluginInfo { name: string; version: string; description: string; enabled: boolean }

const api = useApi()
const installed = ref<PluginInfo[]>([])
const searchQuery = ref('')
const searchResults = ref<PluginInfo[]>([])
const installing = ref<string | null>(null)
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => { installed.value = await api.get<PluginInfo[]>('/api/plugins') })

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchQuery.value.trim()) { searchResults.value = []; return }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try { searchResults.value = await api.get<PluginInfo[]>(`/api/plugins/search?q=${encodeURIComponent(searchQuery.value)}`) }
    finally { searching.value = false }
  }, 400)
}

async function install(name: string) {
  installing.value = name
  try {
    await api.post('/api/plugins/install', { name })
    installed.value = await api.get<PluginInfo[]>('/api/plugins')
    searchResults.value = searchResults.value.filter(p => p.name !== name)
  } finally { installing.value = null }
}

async function remove(name: string) {
  if (!confirm(`Remove plugin "${name}"?`)) return
  await api.del(`/api/plugins/${name}`)
  installed.value = installed.value.filter(p => p.name !== name)
}
</script>

<template>
  <div class="p-8 max-w-3xl space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Plugins</h1>

    <!-- Installed -->
    <section>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Installed</h2>
      <div v-if="installed.length === 0" class="text-sm text-gray-400">No plugins installed.</div>
      <ul class="space-y-2">
        <li v-for="p in installed" :key="p.name" class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <span class="text-sm font-medium text-gray-900">{{ p.name }}</span>
            <span class="ml-2 text-xs text-gray-400">v{{ p.version }}</span>
            <p class="text-xs text-gray-500 mt-0.5">{{ p.description }}</p>
          </div>
          <button class="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded border border-red-200 hover:bg-red-50" @click="remove(p.name)">Remove</button>
        </li>
      </ul>
    </section>

    <!-- Search -->
    <section>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Find plugins</h2>
      <input v-model="searchQuery" placeholder="Search npm for bldmrk plugins…" class="w-full border rounded px-3 py-2 text-sm" @input="onSearch" />
      <div v-if="searching" class="text-xs text-gray-400 mt-2">Searching…</div>
      <ul v-if="searchResults.length" class="mt-2 space-y-2">
        <li v-for="p in searchResults" :key="p.name" class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <span class="text-sm font-medium text-gray-900">{{ p.name }}</span>
            <p class="text-xs text-gray-500 mt-0.5">{{ p.description }}</p>
          </div>
          <button
            class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            :disabled="installing === p.name"
            @click="install(p.name)"
          >{{ installing === p.name ? 'Installing…' : 'Install' }}</button>
        </li>
      </ul>
    </section>
  </div>
</template>
