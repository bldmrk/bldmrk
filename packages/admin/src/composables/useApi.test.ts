import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.js'
import { useApi, ApiError } from './useApi.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mockFetch.mockReset()
})

describe('useApi', () => {
  it('get() sends Authorization: Bearer header', async () => {
    localStorage.setItem('bldmrk_token', 'my_token')
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 1 }))

    const api = useApi()
    await api.get('/api/pages')

    expect(mockFetch).toHaveBeenCalledWith('/api/pages', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer my_token' }),
    }))
  })

  it('on 401: refreshes token and retries request', async () => {
    localStorage.setItem('bldmrk_token', 'old_token')
    localStorage.setItem('bldmrk_refresh_token', 'ref_token')

    // First call: 401, refresh: success with new token, retry: success
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 401))                              // initial request → 401
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new_token' }))         // refresh call
      .mockResolvedValueOnce(jsonResponse({ data: 'ok' }))                       // retry

    const api = useApi()
    const result = await api.get<{ data: string }>('/api/pages')

    expect(result).toEqual({ data: 'ok' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('on second 401 after refresh: calls logout()', async () => {
    localStorage.setItem('bldmrk_token', 'old_token')
    localStorage.setItem('bldmrk_refresh_token', 'ref_token')

    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 401))        // initial → 401
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new_token' })) // refresh ok
      .mockResolvedValueOnce(jsonResponse({}, 401))        // retry → still 401

    const auth = useAuthStore()
    const logoutSpy = vi.spyOn(auth, 'logout')

    const api = useApi()
    await expect(api.get('/api/pages')).rejects.toThrow(ApiError)
    expect(logoutSpy).toHaveBeenCalled()
  })

  it('ApiError contains HTTP status and server message', async () => {
    localStorage.setItem('bldmrk_token', 'tok')
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))

    const api = useApi()
    try {
      await api.get('/api/missing')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(404)
      expect((e as ApiError).message).toBe('Not found')
    }
  })
})
