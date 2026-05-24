<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'
import { useRouter } from 'vue-router'
import PageTree from '@/components/PageTree.vue'

interface Page {
  slug: string
  meta: { title: string; template?: string; published?: boolean; date?: string }
}

const api = useApi()
const router = useRouter()
const view = ref<'tree' | 'list'>('tree')
const showModal = ref(false)
const newTitle = ref('')
const newSlug = ref('')
const newTemplate = ref('default')

const { data: pages, refetch } = useQuery<Page[]>({
  queryKey: ['pages'],
  queryFn: () => api.get<Page[]>('/api/pages'),
})

const sorted = computed(() =>
  [...(pages.value ?? [])].sort((a, b) => a.slug.localeCompare(b.slug))
)

async function createPage() {
  const slug = newSlug.value
  await api.post('/api/pages', { slug, title: newTitle.value, template: newTemplate.value })
  showModal.value = false
  newTitle.value = ''
  newSlug.value = ''
  router.push(`/pages/${slug}`)
}

function onTitleInput() {
  newSlug.value = newTitle.value.toLowerCase().replace(/\s+/g, '-')
}
</script>

<template>
  <div class="p-8 max-w-4xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Pages</h1>
      <div class="flex items-center gap-2">
        <button
          :class="['px-3 py-1.5 text-sm rounded', view === 'tree' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700']"
          @click="view = 'tree'"
        >Tree</button>
        <button
          :class="['px-3 py-1.5 text-sm rounded', view === 'list' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700']"
          @click="view = 'list'"
        >List</button>
        <button data-testid="new-page-btn" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" @click="showModal = true">
          + New page
        </button>
      </div>
    </div>

    <PageTree v-if="view === 'tree'" />

    <table v-else class="w-full text-sm">
      <thead class="border-b border-gray-200">
        <tr class="text-left text-gray-500">
          <th class="pb-2 font-medium">Slug</th>
          <th class="pb-2 font-medium">Title</th>
          <th class="pb-2 font-medium">Template</th>
          <th class="pb-2 font-medium">Published</th>
          <th class="pb-2 font-medium">Date</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr
          v-for="page in sorted"
          :key="page.slug"
          class="hover:bg-gray-50 cursor-pointer"
          @click="router.push(`/pages/${page.slug}`)"
        >
          <td class="py-2 text-gray-500 font-mono text-xs">{{ page.slug }}</td>
          <td class="py-2 text-gray-900">{{ page.meta.title }}</td>
          <td class="py-2 text-gray-500">{{ page.meta.template ?? '—' }}</td>
          <td class="py-2">
            <span :class="page.meta.published ? 'text-green-600' : 'text-gray-400'">
              {{ page.meta.published ? '✓' : '—' }}
            </span>
          </td>
          <td class="py-2 text-gray-400 text-xs">{{ page.meta.date ?? '—' }}</td>
        </tr>
      </tbody>
    </table>

    <!-- New page modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showModal = false">
      <form class="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl" @submit.prevent="createPage">
        <h2 class="text-lg font-semibold text-gray-900">New page</h2>
        <div class="space-y-2">
          <input v-model="newTitle" placeholder="Title" required class="w-full border rounded px-3 py-2 text-sm" @input="onTitleInput" />
          <input v-model="newSlug" placeholder="Slug" required class="w-full border rounded px-3 py-2 text-sm font-mono" />
          <select v-model="newTemplate" class="w-full border rounded px-3 py-2 text-sm">
            <option value="default">Default</option>
            <option value="blog">Blog</option>
            <option value="modular">Modular</option>
          </select>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" class="px-3 py-1.5 text-sm border rounded" @click="showModal = false">Cancel</button>
          <button type="submit" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
