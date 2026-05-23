<script setup lang="ts">
import { useBuildStatus } from '@/composables/useBuildStatus.js'

const { status, logs, duration, triggerBuild } = useBuildStatus()

const statusColors: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-600',
  queued: 'bg-yellow-100 text-yellow-700',
  building: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 p-4 space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-gray-700">Build</span>
        <span :class="['px-2 py-0.5 rounded text-xs font-medium', statusColors[status] ?? statusColors.idle]">
          {{ status }}
        </span>
        <span v-if="duration" class="text-xs text-gray-400">{{ (duration / 1000).toFixed(1) }}s</span>
      </div>
      <button
        class="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
        :disabled="status === 'building' || status === 'queued'"
        @click="triggerBuild"
      >
        Build
      </button>
    </div>
    <pre
      v-if="logs.length > 0"
      class="bg-gray-950 text-gray-100 text-xs rounded p-3 max-h-48 overflow-y-auto font-mono"
    >{{ logs.slice(-50).join('\n') }}</pre>
  </div>
</template>
