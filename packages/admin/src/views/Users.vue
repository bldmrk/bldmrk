<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi.js'
import UserEdit from './users/UserEdit.vue'

interface User { id: string; email: string; role: 'admin' | 'editor' | 'viewer'; createdAt?: string }

const api = useApi()
const users = ref<User[]>([])
const editTarget = ref<User | null>(null)
const showModal = ref(false)

async function load() { users.value = await api.get<User[]>('/api/users') }
onMounted(load)

function openCreate() { editTarget.value = null; showModal.value = true }
function openEdit(u: User) { editTarget.value = u; showModal.value = true }
async function onSaved() { showModal.value = false; await load() }

async function remove(id: string, email: string) {
  if (!confirm(`Delete user "${email}"?`)) return
  await api.del(`/api/users/${id}`)
  users.value = users.value.filter(u => u.id !== id)
}
</script>

<template>
  <div class="p-8 max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Users</h1>
      <button class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" data-testid="new-user-btn" @click="openCreate">+ New user</button>
    </div>

    <table class="w-full text-sm">
      <thead class="border-b border-gray-200">
        <tr class="text-left text-xs text-gray-500 uppercase">
          <th class="pb-2 font-medium">Email</th>
          <th class="pb-2 font-medium">Role</th>
          <th class="pb-2 font-medium">Created</th>
          <th class="pb-2 font-medium"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr v-for="u in users" :key="u.id" class="hover:bg-gray-50">
          <td class="py-2 text-gray-900">{{ u.email }}</td>
          <td class="py-2">
            <span :class="['px-2 py-0.5 rounded text-xs font-medium', u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600']">{{ u.role }}</span>
          </td>
          <td class="py-2 text-gray-400 text-xs">{{ u.createdAt?.slice(0, 10) ?? '—' }}</td>
          <td class="py-2 flex gap-2 justify-end">
            <button class="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded border border-gray-200" @click="openEdit(u)">Edit</button>
            <button class="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200" data-testid="delete-user" @click="remove(u.id, u.email)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showModal = false">
      <UserEdit :user="editTarget" @saved="onSaved" @cancel="showModal = false" />
    </div>
  </div>
</template>
