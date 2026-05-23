<script setup lang="ts">
import { ref } from 'vue'
import { useHubApi } from '../composables/useHubApi.js'

const emit = defineEmits<{ authenticated: [] }>()

const { getSites } = useHubApi()

const token = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  if (!token.value.trim()) {
    error.value = 'Please enter a hub token.'
    return
  }

  loading.value = true
  error.value = null

  localStorage.setItem('bldmrk_hub_token', token.value.trim())

  try {
    await getSites()
    emit('authenticated')
  } catch (e) {
    localStorage.removeItem('bldmrk_hub_token')
    if (e instanceof Error && 'status' in e && (e.status === 401 || e.status === 403)) {
      error.value = 'Invalid hub token. Please check your FOLIO_HUB_TOKEN.'
    } else {
      error.value = e instanceof Error ? e.message : 'Authentication failed.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="hub-login">
    <div class="login-card">
      <h1>bldmrk Hub</h1>
      <p class="description">Enter your hub token to access the multi-site dashboard.</p>

      <form @submit.prevent="handleSubmit">
        <div class="field">
          <label for="token">Hub Token</label>
          <input
            id="token"
            v-model="token"
            type="password"
            placeholder="Enter FOLIO_HUB_TOKEN value"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? 'Authenticating...' : 'Sign In' }}
        </button>
      </form>

      <p class="hint">
        Set <code>FOLIO_HUB_TOKEN</code> in your environment to enable hub access.
      </p>
    </div>
  </div>
</template>

<style scoped>
.hub-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.login-card {
  background: white;
  padding: 2.5rem;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 380px;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
}

.description {
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 1.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.error-message {
  padding: 0.625rem 0.875rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.btn-submit {
  width: 100%;
  padding: 0.7rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-submit:not(:disabled):hover {
  background: #2563eb;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: #9ca3af;
  text-align: center;
}

code {
  background: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: monospace;
}
</style>
