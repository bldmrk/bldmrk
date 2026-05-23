// Calls /__hub/api/* endpoints
// Reads hub token from localStorage key 'bldmrk_hub_token'
// Sends X-Hub-Token header on every request

export interface SiteInfo {
  id: string
  domain: string
  aliases: string[]
  contentDir: string
}

export function useHubApi() {
  function getToken(): string {
    return localStorage.getItem('bldmrk_hub_token') ?? ''
  }

  function headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Hub-Token': getToken(),
    }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/__hub/api${path}`, {
      ...init,
      headers: { ...headers(), ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      const err = new Error(`Hub API error: ${res.status} ${res.statusText}`)
      ;(err as Error & { status: number }).status = res.status
      throw err
    }
    return res.json() as Promise<T>
  }

  async function getSites(): Promise<SiteInfo[]> {
    return request<SiteInfo[]>('/sites')
  }

  async function triggerBuild(siteId: string): Promise<void> {
    await request<void>(`/sites/${siteId}/build`, { method: 'POST' })
  }

  async function triggerBackup(siteId: string): Promise<void> {
    await request<void>(`/sites/${siteId}/backup`, { method: 'POST' })
  }

  return { getSites, triggerBuild, triggerBackup, getToken }
}
