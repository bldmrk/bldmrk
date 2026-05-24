<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  try {
    await auth.login(email.value, password.value)
    await router.push((router.currentRoute.value.query.redirect as string) ?? '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <form class="w-full max-w-sm space-y-4 bg-white p-8 rounded-lg shadow" @submit.prevent="submit">
      <h1 class="text-2xl font-bold text-gray-900">bldmrk Admin</h1>
      <p v-if="error" data-testid="login-error" class="text-sm text-red-600">{{ error }}</p>
      <input v-model="email" name="email" type="email" placeholder="Email" required class="w-full border rounded px-3 py-2 text-sm" />
      <input v-model="password" name="password" type="password" placeholder="Password" required class="w-full border rounded px-3 py-2 text-sm" />
      <button type="submit" class="w-full bg-gray-900 text-white rounded px-3 py-2 text-sm font-medium">Sign in</button>
    </form>
  </div>
</template>
