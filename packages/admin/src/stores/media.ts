import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi.js'

export interface MediaObject {
  id: string
  filename: string
  originalFilename?: string
  url: string
  webpUrl?: string
  size?: number
  mimeType?: string
  pageId?: string
  createdAt?: string
}

export const useMediaStore = defineStore('media', () => {
  const items = ref<MediaObject[]>([])
  const loading = ref(false)
  const searchQuery = ref('')
  const api = useApi()

  const filteredItems = computed(() => {
    const q = searchQuery.value.toLowerCase()
    if (!q) return items.value
    return items.value.filter((m) => m.filename.toLowerCase().includes(q))
  })

  async function loadMedia(pageId?: string): Promise<void> {
    loading.value = true
    try {
      const url = pageId ? `/api/media?pageId=${encodeURIComponent(pageId)}` : '/api/media'
      items.value = await api.get<MediaObject[]>(url)
    } finally {
      loading.value = false
    }
  }

  async function uploadMedia(file: File, pageId?: string): Promise<MediaObject> {
    const form = new FormData()
    form.append('file', file)
    if (pageId) form.append('pageId', pageId)

    // useApi doesn't handle FormData directly — use fetch directly here
    const { useAuthStore } = await import('@/stores/auth.js')
    const auth = useAuthStore()
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      body: form,
    })
    if (!res.ok) throw new Error('Upload failed')
    const obj: MediaObject = await res.json() as MediaObject
    items.value.unshift(obj)
    return obj
  }

  async function deleteMedia(id: string): Promise<void> {
    await api.del(`/api/media/${id}`)
    items.value = items.value.filter((m) => m.id !== id)
  }

  return { items, loading, searchQuery, filteredItems, loadMedia, uploadMedia, deleteMedia }
})
