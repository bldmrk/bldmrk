<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'

interface User { id: string; email: string; role: 'admin' | 'editor' | 'viewer' }

const props = defineProps<{ user: User | null }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const api = useApi()
const email = ref(props.user?.email ?? '')
const role = ref<'admin' | 'editor' | 'viewer'>(props.user?.role ?? 'editor')
const password = ref('')
const saving = ref(false)
const error = ref('')

async function submit() {
  saving.value = true
  error.value = ''
  try {
    if (props.user) {
      const body: Record<string, unknown> = { role: role.value }
      if (password.value) body.password = password.value
      await api.put(`/api/users/${props.user.id}`, body)
    } else {
      await api.post('/api/users', { email: email.value, password: password.value, role: role.value })
    }
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4" @submit.prevent="submit">
    <h2 class="text-lg font-semibold text-gray-900">{{ user ? 'Edit user' : 'New user' }}</h2>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <label class="block"><span class="text-xs font-medium text-gray-500 uppercase">Email</span>
      <input v-model="email" type="email" name="email" required :disabled="!!user" class="mt-1 w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50" /></label>

    <label class="block"><span class="text-xs font-medium text-gray-500 uppercase">Role</span>
      <select v-model="role" name="role" class="mt-1 w-full border rounded px-3 py-2 text-sm">
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select></label>

    <label class="block"><span class="text-xs font-medium text-gray-500 uppercase">Password{{ user ? ' (leave blank to keep)' : '' }}</span>
      <input v-model="password" type="password" name="password" :required="!user" class="mt-1 w-full border rounded px-3 py-2 text-sm" /></label>

    <div class="flex gap-2 justify-end pt-2">
      <button type="button" class="px-4 py-2 text-sm border rounded hover:bg-gray-50" @click="emit('cancel')">Cancel</button>
      <button type="submit" :disabled="saving" class="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </form>
</template>
