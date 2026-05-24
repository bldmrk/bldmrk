<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.js'
import { useRouter } from 'vue-router'
import BuildStatus from '@/components/BuildStatus.vue'
import DeployPanel from '@/components/DeployPanel.vue'
import GitHistory from '@/components/GitHistory.vue'
import BackupPanel from '@/components/BackupPanel.vue'

interface PageMeta { slug: string; meta: { title: string; date?: string | Date } }
interface BuildResult { success: boolean; duration: number; pages: number }

const api = useApi()

const { data: pages } = useQuery<PageMeta[]>({
  queryKey: ['pages'],
  queryFn: () => api.get<PageMeta[]>('/api/pages'),
})

const { data: buildHistory } = useQuery<BuildResult[]>({
  queryKey: ['build-history'],
  queryFn: () => api.get<BuildResult[]>('/api/build/history'),
  refetchInterval: 10_000,
})

const auth = useAuthStore()
const router = useRouter()

const recentPages = () =>
  [...(pages.value ?? [])]
    .sort((a, b) => String(b.meta.date ?? '').localeCompare(String(a.meta.date ?? '')))
    .slice(0, 5)

const lastBuild = () => buildHistory.value?.[0]

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="p-8 space-y-6 max-w-4xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <button data-testid="logout-btn" class="text-sm text-gray-500 hover:text-gray-900" @click="logout">Sign out</button>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Total pages</p>
        <p class="text-3xl font-bold text-gray-900 mt-1">{{ pages?.length ?? '—' }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="text-sm text-gray-500">Last build</p>
        <p class="text-lg font-semibold mt-1" :class="lastBuild()?.success ? 'text-green-600' : 'text-red-600'">
          {{ lastBuild() ? (lastBuild()!.success ? 'Success' : 'Failed') : '—' }}
        </p>
        <p v-if="lastBuild()" class="text-xs text-gray-400">{{ lastBuild()!.pages }} pages</p>
      </div>
    </div>

    <BuildStatus />

    <DeployPanel />

    <GitHistory />

    <BackupPanel />

    <div v-if="recentPages().length > 0">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent pages</h2>
      <ul class="divide-y divide-gray-100">
        <li v-for="page in recentPages()" :key="page.slug" class="py-2 flex justify-between items-center">
          <span class="text-sm text-gray-900">{{ page.meta.title }}</span>
          <span class="text-xs text-gray-400">{{ page.slug }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
