import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockLoginSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ accessToken: 'acc_token', refreshToken: 'ref_token' }),
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mockFetch.mockReset()
})

describe('useAuthStore', () => {
  it('login() stores tokens in store and localStorage', async () => {
    mockLoginSuccess()
    const auth = useAuthStore()
    await auth.login('a@b.com', 'pass')
    expect(auth.token).toBe('acc_token')
    expect(localStorage.getItem('bldmrk_token')).toBe('acc_token')
  })

  it('logout() clears store and localStorage', async () => {
    mockLoginSuccess()
    const auth = useAuthStore()
    await auth.login('a@b.com', 'pass')
    auth.logout()
    expect(auth.token).toBeNull()
    expect(localStorage.getItem('bldmrk_token')).toBeNull()
  })

  it('isLoggedIn is false initially, true after login', async () => {
    mockLoginSuccess()
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(false)
    await auth.login('a@b.com', 'pass')
    expect(auth.isLoggedIn).toBe(true)
  })

  it('hydrates token from localStorage on store init', () => {
    localStorage.setItem('bldmrk_token', 'existing_token')
    const auth = useAuthStore()
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.token).toBe('existing_token')
  })

  it('login() throws on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' }),
    })
    const auth = useAuthStore()
    await expect(auth.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})
