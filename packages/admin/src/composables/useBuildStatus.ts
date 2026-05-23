import { ref, onUnmounted } from 'vue'
import { useApi } from './useApi.js'

export type BuildStatus = 'idle' | 'queued' | 'building' | 'done' | 'error'

export function useBuildStatus() {
  const status = ref<BuildStatus>('idle')
  const logs = ref<string[]>([])
  const duration = ref<number | undefined>(undefined)
  const api = useApi()

  const es = new EventSource('/api/build/status', {
    // Note: EventSource doesn't support custom headers — auth handled server-side or via cookie
  })

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
