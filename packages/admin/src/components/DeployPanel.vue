<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'

interface SystemConfig {
  deploy?: {
    netlify?: { url: string }
    vercel?: { url: string }
  }
}

interface DeployStatusEntry {
  triggeredAt: string | null
  success: boolean | null
  error: string | null
}

interface DeployState {
  netlify: DeployStatusEntry
  vercel: DeployStatusEntry
}

interface DeployResult {
  triggered: boolean
  provider: string
}

const api = useApi()
const queryClient = useQueryClient()

const { data: systemConfig } = useQuery<SystemConfig>({
  queryKey: ['config', 'system'],
  queryFn: () => api.get<SystemConfig>('/api/config/system'),
})

const { data: deployStatus, refetch: refetchStatus } = useQuery<DeployState>({
  queryKey: ['deploy', 'status'],
  queryFn: () => api.get<DeployState>('/api/deploy/status'),
  refetchInterval: 30_000,
})

const hasNetlify = computed(() => !!systemConfig.value?.deploy?.netlify?.url)
const hasVercel = computed(() => !!systemConfig.value?.deploy?.vercel?.url)
const hasAnyDeploy = computed(() => hasNetlify.value || hasVercel.value)

const deployingProvider = ref<string | null>(null)
const lastError = ref<string | null>(null)

const netlifyMutation = useMutation({
  mutationFn: () => api.post<DeployResult>('/api/deploy/netlify', {}),
  onMutate: () => {
    deployingProvider.value = 'netlify'
    lastError.value = null
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['deploy', 'status'] })
    void refetchStatus()
  },
  onError: (err: Error) => {
    lastError.value = err.message
  },
  onSettled: () => {
    deployingProvider.value = null
  },
})

const vercelMutation = useMutation({
  mutationFn: () => api.post<DeployResult>('/api/deploy/vercel', {}),
  onMutate: () => {
    deployingProvider.value = 'vercel'
    lastError.value = null
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['deploy', 'status'] })
    void refetchStatus()
  },
  onError: (err: Error) => {
    lastError.value = err.message
  },
  onSettled: () => {
    deployingProvider.value = null
  },
})

function formatTime(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div v-if="hasAnyDeploy" class="rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Deploy</h2>

    <div class="flex flex-wrap gap-2">
      <button
        v-if="hasNetlify"
        data-testid="deploy-netlify"
        class="px-4 py-2 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
        :disabled="deployingProvider !== null"
        @click="netlifyMutation.mutate()"
      >
        <span v-if="deployingProvider === 'netlify'" class="animate-spin">⟳</span>
        Deploy to Netlify
      </button>

      <button
        v-if="hasVercel"
        data-testid="deploy-vercel"
        class="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
        :disabled="deployingProvider !== null"
        @click="vercelMutation.mutate()"
      >
        <span v-if="deployingProvider === 'vercel'" class="animate-spin">⟳</span>
        Deploy to Vercel
      </button>
    </div>

    <div v-if="lastError" class="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
      {{ lastError }}
    </div>

    <div v-if="deployStatus" class="space-y-2 text-xs text-gray-500">
      <div v-if="hasNetlify" class="flex items-center gap-2">
        <span class="font-medium text-gray-700">Netlify:</span>
        <span
          v-if="deployStatus.netlify.triggeredAt"
          :class="deployStatus.netlify.success ? 'text-green-600' : 'text-red-500'"
        >
          {{ deployStatus.netlify.success ? 'Success' : 'Failed' }}
          · {{ formatTime(deployStatus.netlify.triggeredAt) }}
        </span>
        <span v-else class="text-gray-400">Never deployed</span>
      </div>
      <div v-if="hasVercel" class="flex items-center gap-2">
        <span class="font-medium text-gray-700">Vercel:</span>
        <span
          v-if="deployStatus.vercel.triggeredAt"
          :class="deployStatus.vercel.success ? 'text-green-600' : 'text-red-500'"
        >
          {{ deployStatus.vercel.success ? 'Success' : 'Failed' }}
          · {{ formatTime(deployStatus.vercel.triggeredAt) }}
        </span>
        <span v-else class="text-gray-400">Never deployed</span>
      </div>
    </div>
  </div>
</template>
