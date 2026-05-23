<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'

interface BackupMeta {
  id: string
  type: 'content' | 'full'
  createdAt: string
  sizeBytes: number
  remote?: { provider: string; uploaded: boolean }
}

const api = useApi()
const queryClient = useQueryClient()

const selectedType = ref<'content' | 'full'>('content')
const restoreTarget = ref<string | null>(null)
const lastError = ref<string | null>(null)

const { data: backups, isLoading } = useQuery<BackupMeta[]>({
  queryKey: ['backups'],
  queryFn: () => api.get<BackupMeta[]>('/api/backup'),
  refetchInterval: 30_000,
})

const createMutation = useMutation({
  mutationFn: (type: 'content' | 'full') =>
    api.post<BackupMeta>('/api/backup', { type }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['backups'] })
    lastError.value = null
  },
  onError: (err: Error) => {
    lastError.value = err.message
  },
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => api.del(`/api/backup/${id}`),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['backups'] })
  },
  onError: (err: Error) => {
    lastError.value = err.message
  },
})

const restoreMutation = useMutation({
  mutationFn: (id: string) =>
    api.post<{ status: string }>(`/api/backup/${id}/restore`, {}),
  onSuccess: () => {
    restoreTarget.value = null
    lastError.value = null
  },
  onError: (err: Error) => {
    restoreTarget.value = null
    lastError.value = err.message
  },
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function downloadUrl(id: string): string {
  return `/api/backup/${id}/download`
}

function confirmRestore(id: string): void {
  restoreTarget.value = id
}

function cancelRestore(): void {
  restoreTarget.value = null
}

function doRestore(): void {
  if (restoreTarget.value) {
    restoreMutation.mutate(restoreTarget.value)
  }
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Backup</h2>

    <div class="flex items-center gap-3">
      <select
        v-model="selectedType"
        data-testid="backup-type-select"
        class="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="content">Content only</option>
        <option value="full">Full backup</option>
      </select>

      <button
        data-testid="backup-create-btn"
        class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        :disabled="createMutation.isPending.value"
        @click="createMutation.mutate(selectedType)"
      >
        <span v-if="createMutation.isPending.value" class="animate-spin inline-block">⟳</span>
        {{ createMutation.isPending.value ? 'Creating...' : 'Create backup' }}
      </button>
    </div>

    <div v-if="lastError" class="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
      {{ lastError }}
    </div>

    <div v-if="isLoading" class="text-sm text-gray-400">Loading backups...</div>

    <div v-else-if="!backups || backups.length === 0" class="text-sm text-gray-400">
      No backups yet.
    </div>

    <ul v-else class="divide-y divide-gray-100 text-sm">
      <li
        v-for="backup in backups"
        :key="backup.id"
        class="py-2 flex items-center justify-between gap-2"
      >
        <div class="min-w-0">
          <p class="font-medium text-gray-900 truncate">{{ backup.id }}</p>
          <p class="text-xs text-gray-500">
            {{ backup.type }} · {{ formatSize(backup.sizeBytes) }} · {{ formatDate(backup.createdAt) }}
            <span v-if="backup.remote" class="ml-2">
              <span v-if="backup.remote.uploaded" class="text-green-600">↑ {{ backup.remote.provider }}</span>
              <span v-else class="text-red-500">↑ {{ backup.remote.provider }} (failed)</span>
            </span>
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <a
            :href="downloadUrl(backup.id)"
            data-testid="backup-download-btn"
            class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            download
          >
            Download
          </a>

          <button
            data-testid="backup-restore-btn"
            class="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
            :disabled="restoreMutation.isPending.value"
            @click="confirmRestore(backup.id)"
          >
            Restore
          </button>

          <button
            data-testid="backup-delete-btn"
            class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            :disabled="deleteMutation.isPending.value"
            @click="deleteMutation.mutate(backup.id)"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>

    <!-- Restore confirmation dialog -->
    <div
      v-if="restoreTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="restore-dialog"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h3 class="text-base font-semibold text-gray-900">Confirm restore</h3>
        <p class="text-sm text-gray-600">
          Restoring this backup will overwrite your current content. The site will be briefly
          offline during the restore. This action cannot be undone.
        </p>
        <p class="text-xs text-gray-500 font-mono truncate">{{ restoreTarget }}</p>

        <div class="flex gap-3 justify-end">
          <button
            class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            @click="cancelRestore"
          >
            Cancel
          </button>
          <button
            data-testid="restore-confirm-btn"
            class="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            :disabled="restoreMutation.isPending.value"
            @click="doRestore"
          >
            {{ restoreMutation.isPending.value ? 'Restoring...' : 'Restore' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
