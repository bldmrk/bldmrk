<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi.js'

interface TaxonomyEntry {
  value: string
  count: number
  slug: string
}

interface PageObject {
  slug: string
  meta: { title: string; published: boolean; template: string }
}

interface TagDetail {
  entry: TaxonomyEntry
  pages: PageObject[]
}

const api = useApi()

const { data: tags, isLoading: tagsLoading } = useQuery<TaxonomyEntry[]>({
  queryKey: ['taxonomy-tags'],
  queryFn: () => api.get<TaxonomyEntry[]>('/api/taxonomy/tags'),
})

const selectedTag = ref<string | null>(null)

const { data: tagDetail, isLoading: detailLoading } = useQuery<TagDetail>({
  queryKey: computed(() => ['taxonomy-tag-detail', selectedTag.value]),
  queryFn: () => api.get<TagDetail>(`/api/taxonomy/tags/${encodeURIComponent(selectedTag.value!)}`),
  enabled: computed(() => selectedTag.value !== null),
})

function selectTag(tag: TaxonomyEntry) {
  selectedTag.value = selectedTag.value === tag.value ? null : tag.value
}
</script>

<template>
  <div class="p-8 max-w-4xl space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Taxonomy</h1>

    <div v-if="tagsLoading" class="text-sm text-gray-400">Loading tags...</div>

    <div v-else-if="!tags || tags.length === 0" class="text-sm text-gray-400">
      No tags found. Add tags to your pages in their frontmatter.
    </div>

    <div v-else class="space-y-4">
      <p class="text-sm text-gray-500">{{ tags.length }} tag{{ tags.length !== 1 ? 's' : '' }} found across all published pages. Click a tag to see its pages.</p>

      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2 pr-4">Tag</th>
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2 pr-4">Slug</th>
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2">Pages</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="tag in tags" :key="tag.value">
            <tr
              class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-blue-50 hover:bg-blue-50': selectedTag === tag.value }"
              @click="selectTag(tag)"
            >
              <td class="py-2 pr-4">
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full transition-transform"
                    :class="selectedTag === tag.value ? 'bg-blue-500 scale-125' : 'bg-gray-300'"
                  ></span>
                  <span class="font-medium text-gray-900">{{ tag.value }}</span>
                </span>
              </td>
              <td class="py-2 pr-4 text-gray-500 font-mono text-xs">{{ tag.slug }}</td>
              <td class="py-2">
                <span class="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-semibold" :class="selectedTag === tag.value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'">
                  {{ tag.count }}
                </span>
              </td>
            </tr>

            <tr v-if="selectedTag === tag.value" :key="`${tag.value}-detail`">
              <td colspan="3" class="pb-3 pt-1 px-2">
                <div v-if="detailLoading" class="text-xs text-gray-400 py-2">Loading pages...</div>
                <div v-else-if="tagDetail" class="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <p class="text-xs font-semibold text-blue-700 mb-2">Pages tagged "{{ tag.value }}"</p>
                  <ul class="space-y-1">
                    <li v-for="page in tagDetail.pages" :key="page.slug" class="flex items-center justify-between">
                      <span class="text-sm text-gray-900">{{ page.meta.title }}</span>
                      <a
                        :href="`/pages/${page.slug}`"
                        class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >Edit</a>
                    </li>
                  </ul>
                  <div v-if="tagDetail.pages.length === 0" class="text-xs text-gray-400">No pages.</div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
