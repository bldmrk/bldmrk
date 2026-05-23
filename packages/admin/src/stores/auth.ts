import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  email: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('bldmrk_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('bldmrk_refresh_token'))
  const currentUser = ref<User | null>(null)

  const isLoggedIn = computed(() => token.value !== null)

  async function login(email: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.message ?? 'Login failed')
    }
    const data = await res.json()
    token.value = data.accessToken
    refreshToken.value = data.refreshToken
    currentUser.value = data.user ?? null
    localStorage.setItem('bldmrk_token', data.accessToken)
    localStorage.setItem('bldmrk_refresh_token', data.refreshToken)
  }

  function logout(): void {
    token.value = null
    refreshToken.value = null
    currentUser.value = null
    localStorage.removeItem('bldmrk_token')
    localStorage.removeItem('bldmrk_refresh_token')
  }

  async function refresh(): Promise<void> {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken.value }),
    })
    if (!res.ok) { logout(); return }
    const data = await res.json()
    token.value = data.accessToken
    localStorage.setItem('bldmrk_token', data.accessToken)
  }

  return { token, refreshToken, currentUser, isLoggedIn, login, logout, refresh }
})
