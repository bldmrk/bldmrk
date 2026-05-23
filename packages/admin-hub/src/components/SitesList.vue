<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHubApi, type SiteInfo } from '../composables/useHubApi.js'

const { getSites, triggerBuild, triggerBackup } = useHubApi()

const sites = ref<SiteInfo[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
const pendingAction = ref<string | null>(null)

onMounted(async () => {
  await loadSites()
})

async function loadSites() {
  loading.value = true
  error.value = null
  try {
    sites.value = await getSites()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load sites'
  } finally {
    loading.value = false
  }
}

function showToast(message: string, type: 'success' | 'error') {
  toast.value = { message, type }
  setTimeout(() => {
    toast.value = null
  }, 3000)
}

async function handleBuild(site: SiteInfo) {
  pendingAction.value = `build-${site.id}`
  try {
    await triggerBuild(site.id)
    showToast(`Build triggered for ${site.domain}`, 'success')
  } catch {
    showToast(`Failed to trigger build for ${site.domain}`, 'error')
  } finally {
    pendingAction.value = null
  }
}

async function handleBackup(site: SiteInfo) {
  pendingAction.value = `backup-${site.id}`
  try {
    await triggerBackup(site.id)
    showToast(`Backup triggered for ${site.domain}`, 'success')
  } catch {
    showToast(`Failed to trigger backup for ${site.domain}`, 'error')
  } finally {
    pendingAction.value = null
  }
}
</script>

<template>
  <div class="sites-list">
    <header class="header">
      <h1>bldmrk Hub</h1>
      <span class="subtitle">Multi-Site Dashboard</span>
    </header>

    <main class="main">
      <div v-if="loading" class="state-message">Loading sites...</div>
      <div v-else-if="error" class="state-message error">{{ error }}</div>
      <div v-else-if="sites.length === 0" class="state-message">No sites configured.</div>
      <div v-else class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Aliases</th>
              <th>Content Dir</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="site in sites" :key="site.id">
              <td class="domain">{{ site.domain }}</td>
              <td class="aliases">{{ site.aliases.join(', ') || '—' }}</td>
              <td class="content-dir">{{ site.contentDir }}</td>
              <td class="actions">
                <button
                  class="btn btn-primary"
                  :disabled="pendingAction !== null"
                  @click="handleBuild(site)"
                >
                  {{ pendingAction === `build-${site.id}` ? 'Building...' : 'Build' }}
                </button>
                <button
                  class="btn btn-secondary"
                  :disabled="pendingAction !== null"
                  @click="handleBackup(site)"
                >
                  {{ pendingAction === `backup-${site.id}` ? 'Backing up...' : 'Backup' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <Transition name="toast">
      <div v-if="toast" :class="['toast', toast.type]">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sites-list {
  min-height: 100vh;
}

.header {
  background: #1a1a2e;
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

.subtitle {
  font-size: 0.9rem;
  color: #94a3b8;
}

.main {
  padding: 2rem;
}

.state-message {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}

.state-message.error {
  color: #dc3545;
}

.table-wrapper {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6c757d;
  border-bottom: 1px solid #dee2e6;
}

.table td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.table tr:last-child td {
  border-bottom: none;
}

.domain {
  font-weight: 600;
  color: #1a1a2e;
}

.aliases,
.content-dir {
  font-family: monospace;
  font-size: 0.875rem;
  color: #495057;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:not(:disabled):hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e2e8f0;
  color: #374151;
}

.btn-secondary:not(:disabled):hover {
  background: #cbd5e1;
}

.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 0.875rem 1.25rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.toast.success {
  background: #10b981;
  color: white;
}

.toast.error {
  background: #ef4444;
  color: white;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
