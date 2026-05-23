import { useAuthStore } from '@/stores/auth.js'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = useAuthStore()

  async function doFetch(token: string | null): Promise<Response> {
    return fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  }

  let res = await doFetch(auth.token)

  if (res.status === 401) {
    try {
      await auth.refresh()
      res = await doFetch(auth.token)
    } catch {
      auth.logout()
      throw new ApiError(401, 'Session expired')
    }
    if (res.status === 401) {
      auth.logout()
      throw new ApiError(401, 'Session expired')
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as Record<string, string>).message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const auth = useAuthStore()

  async function doFetch(token: string | null): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
  }

  let res = await doFetch(auth.token)

  if (res.status === 401) {
    try {
      await auth.refresh()
      res = await doFetch(auth.token)
    } catch {
      auth.logout()
      throw new ApiError(401, 'Session expired')
    }
    if (res.status === 401) {
      auth.logout()
      throw new ApiError(401, 'Session expired')
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, (data as Record<string, string>).message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

export function useApi() {
  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
    del: (path: string) => request<void>('DELETE', path),
    upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
  }
}
