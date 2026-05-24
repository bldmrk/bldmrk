import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'

export interface PageMeta {
  title: string
  description?: string
  template?: string
  published?: boolean
  date?: string
  author?: string
  tags?: string[]
  routes?: { default?: string; aliases?: string[] }
}

export interface PageObject {
  slug: string
  rawContent: string
  meta: PageMeta
}

export const usePagesStore = defineStore('pages', () => {
  const currentPage = ref<PageObject | null>(null)
  const isDirty = ref(false)
  const api = useApi()

  async function loadPage(slug: string): Promise<void> {
    const page = await api.get<PageObject>(`/api/pages/${slug}`)
    currentPage.value = page
    isDirty.value = false
  }

  async function savePage(): Promise<void> {
    if (!currentPage.value) return
    await api.put(`/api/pages/${currentPage.value.slug}`, {
      content: currentPage.value.rawContent,
      ...currentPage.value.meta,
    })
    isDirty.value = false
  }

  async function deletePage(slug: string): Promise<void> {
    await api.del(`/api/pages/${slug}`)
    currentPage.value = null
    isDirty.value = false
  }

  function markDirty() {
    isDirty.value = true
  }

  return { currentPage, isDirty, loadPage, savePage, deletePage, markDirty }
})
