import { ref, onUnmounted } from 'vue'
import { useApi } from './useApi.js'
import { useAuthStore } from '@/stores/auth.js'

export type BuildStatus = 'idle' | 'queued' | 'building' | 'done' | 'error'

export function useBuildStatus() {
  const status = ref<BuildStatus>('idle')
  const logs = ref<string[]>([])
  const duration = ref<number | undefined>(undefined)
  const api = useApi()

  const auth = useAuthStore()
  const sseUrl = auth.token ? `/api/build/status?token=${encodeURIComponent(auth.token)}` : '/api/build/status'
  const es = new EventSource(sseUrl)

  es.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as { status: BuildStatus; log?: string; duration?: number }
      status.value = data.status
      if (data.log) logs.value.push(data.log)
      if (data.duration !== undefined) duration.value = data.duration
    } catch { /* ignore malformed events */ }
  }

  onUnmounted(() => es.close())

  async function triggerBuild(): Promise<void> {
    await api.post('/api/build', {})
  }

  return { status, logs, duration, triggerBuild }
}
