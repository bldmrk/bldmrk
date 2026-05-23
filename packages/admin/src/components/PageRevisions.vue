<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePageRevisions, useRevisionContent, useRestoreRevision } from '@/composables/usePageRevisions.js'

const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ (e: 'restored'): void }>()

const slugRef = computed(() => props.slug)
const selectedHash = ref<string | null>(null)

const { revisions } = usePageRevisions(slugRef)
const { content: preview } = useRevisionContent(selectedHash, slugRef)
const { restore } = useRestoreRevision(slugRef)

function select(hash: string) {
  selectedHash.value = selectedHash.value === hash ? null : hash
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

async function doRestore(hash: string) {
  if (!confirm(`Restore page to revision ${shortHash(hash)}?`)) return
  restore.mutate(hash, {
    onSuccess: () => {
      selectedHash.value = null
      emit('restored')
    },
  })
}
</script>

<template>
  <div class="page-revisions">
    <div v-if="revisions.isLoading.value" class="revisions-loading">Loading history…</div>
    <div v-else-if="!revisions.data.value?.length" class="revisions-empty">
      No revision history yet. Enable auto-commit or use the Git panel to create commits.
    </div>
    <div v-else class="revisions-list">
      <div
        v-for="rev in revisions.data.value"
        :key="rev.hash"
        class="revision-item"
        :class="{ selected: selectedHash === rev.hash }"
        @click="select(rev.hash)"
      >
        <div class="revision-meta">
          <code class="revision-hash">{{ shortHash(rev.hash) }}</code>
          <span class="revision-message">{{ rev.message }}</span>
        </div>
        <div class="revision-info">
          <span class="revision-author">{{ rev.author }}</span>
          <span class="revision-date">{{ formatDate(rev.date) }}</span>
        </div>

        <div v-if="selectedHash === rev.hash" class="revision-preview">
          <div v-if="preview.isLoading.value" class="preview-loading">Loading…</div>
          <pre v-else-if="preview.data.value" class="preview-content">{{ preview.data.value.content }}</pre>
          <button
            class="btn btn-warning"
            :disabled="restore.isPending.value"
            @click.stop="doRestore(rev.hash)"
          >
            {{ restore.isPending.value ? 'Restoring…' : 'Restore this version' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-revisions { display: flex; flex-direction: column; gap: 0.5rem; }
.revisions-loading, .revisions-empty { color: var(--color-text-muted, #888); padding: 1rem 0; }
.revision-item {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.revision-item:hover { background: var(--color-surface-hover, #f8fafc); }
.revision-item.selected { border-color: var(--color-primary, #3b82f6); background: var(--color-primary-subtle, #eff6ff); }
.revision-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.revision-hash { font-size: 0.75rem; background: var(--color-code-bg, #f1f5f9); padding: 1px 5px; border-radius: 3px; }
.revision-message { font-weight: 500; }
.revision-info { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--color-text-muted, #888); }
.revision-preview { margin-top: 0.75rem; border-top: 1px solid var(--color-border, #e2e8f0); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.preview-content { font-size: 0.75rem; background: var(--color-code-bg, #f1f5f9); padding: 0.75rem; border-radius: 4px; max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
.btn { padding: 0.4rem 0.9rem; border-radius: 5px; border: none; cursor: pointer; font-size: 0.875rem; }
.btn-warning { background: #f59e0b; color: #fff; }
.btn-warning:hover:not(:disabled) { background: #d97706; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
