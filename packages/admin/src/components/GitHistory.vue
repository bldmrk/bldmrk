<script setup lang="ts">
import { ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'

interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

const api = useApi()
const queryClient = useQueryClient()

const { data: commits, isLoading } = useQuery<GitCommit[]>({
  queryKey: ['git-log'],
  queryFn: () => api.get<GitCommit[]>('/api/git/log?limit=10'),
  refetchInterval: 30_000,
})

const showCommitModal = ref(false)
const commitMessage = ref('')

const { mutate: doCommit, isPending: isCommitting } = useMutation({
  mutationFn: (message: string) => api.post<{ hash: string; message: string }>('/api/git/commit', { message }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['git-log'] })
    showCommitModal.value = false
    commitMessage.value = ''
  },
})

function openCommitModal() {
  showCommitModal.value = true
}

function closeCommitModal() {
  showCommitModal.value = false
  commitMessage.value = ''
}

function submitCommit() {
  if (!commitMessage.value.trim()) return
  doCommit(commitMessage.value.trim())
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-700">Git History</h2>
      <button
        class="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        @click="openCommitModal"
      >
        Commit
      </button>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-400">Loading history…</div>

    <ul v-else-if="commits && commits.length > 0" class="divide-y divide-gray-100 text-sm">
      <li
        v-for="commit in commits"
        :key="commit.hash"
        class="py-2 flex items-start justify-between gap-2"
      >
        <div class="min-w-0">
          <span class="font-mono text-xs text-gray-400 mr-2">{{ shortHash(commit.hash) }}</span>
          <span class="text-gray-900">{{ commit.message }}</span>
          <div class="text-xs text-gray-400 mt-0.5">{{ commit.author }} &middot; {{ formatDate(commit.date) }}</div>
        </div>
      </li>
    </ul>

    <p v-else class="text-sm text-gray-400">No commits yet.</p>

    <!-- Commit modal -->
    <div
      v-if="showCommitModal"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="closeCommitModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
        <h3 class="text-base font-semibold text-gray-900">Commit changes</h3>
        <p class="text-xs text-gray-500">
          All changes in <code class="bg-gray-100 px-1 rounded">content/</code> will be staged and committed.
        </p>
        <input
          v-model="commitMessage"
          type="text"
          placeholder="Commit message…"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          @keyup.enter="submitCommit"
        />
        <div class="flex gap-2 justify-end">
          <button
            class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            @click="closeCommitModal"
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            :disabled="!commitMessage.trim() || isCommitting"
            @click="submitCommit"
          >
            {{ isCommitting ? 'Committing…' : 'Commit' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
