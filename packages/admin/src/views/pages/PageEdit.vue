<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { usePagesStore } from '@/stores/pages.js'
import MdxEditor from '@/components/MdxEditor.vue'
import PreviewFrame from '@/components/PreviewFrame.vue'
import PageMedia from './PageMedia.vue'
import BlueprintForm from '@/components/blueprint/BlueprintForm.vue'
import PageRevisions from '@/components/PageRevisions.vue'
import { useI18n, type I18nVariant } from '@/composables/useI18n.js'
import { useApi } from '@/composables/useApi.js'
import { useBlueprintForPage } from '@/composables/useBlueprint.js'

const route = useRoute()
const router = useRouter()
const pages = usePagesStore()
const { getVariants } = useI18n()
const api = useApi()

const slug = computed(() => route.params.slug as string)
const splitView = ref(true)
const refreshKey = ref(0)
const activeTab = ref<'content' | 'meta' | 'media' | 'history'>('content')

const currentTemplate = computed(() => (pages.currentPage?.data.template as string | undefined) ?? 'default')
const { data: blueprint } = useBlueprintForPage(currentTemplate)

const metaFormData = computed<Record<string, unknown>>({
  get: () => ({ ...(pages.currentPage?.data ?? {}) }),
  set: (val) => {
    if (!pages.currentPage) return
    Object.assign(pages.currentPage.data, val)
    pages.markDirty()
  },
})

const i18nVariants = ref<I18nVariant[]>([])
const i18nLoading = ref(false)
const creatingTranslation = ref(false)

async function loadVariants(s: string) {
  i18nLoading.value = true
  try {
    i18nVariants.value = await getVariants(s)
  } finally {
    i18nLoading.value = false
  }
}

async function createTranslation(locale: string) {
  const newSlug = `${slug.value}-${locale}`
  creatingTranslation.value = true
  try {
    await api.post('/api/pages', {
      slug: newSlug,
      title: `${pages.currentPage?.data.title ?? slug.value} (${locale})`,
      i18n: { locale, variants: { [locale]: newSlug } },
    })
    await loadVariants(slug.value)
    router.push(`/pages/${encodeURIComponent(newSlug)}`)
  } catch {
    // Error handled silently; user stays on current page
  } finally {
    creatingTranslation.value = false
  }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  pages.loadPage(slug.value)
  void loadVariants(slug.value)
})

watch(slug, (s) => {
  pages.loadPage(s)
  void loadVariants(s)
})

function onContentChange(val: string) {
  if (!pages.currentPage) return
  pages.currentPage.content = val
  pages.markDirty()
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => pages.savePage(), 30_000)
}

async function save() {
  await pages.savePage()
  refreshKey.value++
}

async function deletePage() {
  if (!confirm(`Delete "${pages.currentPage?.data.title}"?`)) return
  await pages.deletePage(slug.value)
  router.push('/pages')
}

onUnmounted(() => { if (autoSaveTimer) clearTimeout(autoSaveTimer) })

onBeforeRouteLeave(() => {
  if (pages.isDirty) {
    return confirm('You have unsaved changes. Leave anyway?')
  }
})
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- Header bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0">
      <div class="flex items-center gap-3 flex-wrap">
        <button class="text-sm text-gray-500 hover:text-gray-900" @click="router.push('/pages')">← Pages</button>
        <span class="text-gray-300">/</span>
        <span class="text-sm font-medium text-gray-900">{{ pages.currentPage?.data.title ?? slug }}</span>
        <span v-if="pages.isDirty" class="text-xs text-amber-500">Unsaved</span>

        <!-- i18n language tabs -->
        <div v-if="i18nVariants.length > 0" class="flex items-center gap-1 ml-2 border border-gray-200 rounded overflow-hidden">
          <button
            v-for="v in i18nVariants"
            :key="v.locale"
            :class="[
              'px-2 py-0.5 text-xs font-medium',
              v.slug === slug ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
            ]"
            @click="router.push(`/pages/${encodeURIComponent(v.slug)}`)"
          >
            {{ v.locale.toUpperCase() }}
          </button>
        </div>
        <button
          v-if="!i18nLoading"
          class="text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-300 rounded px-2 py-0.5"
          :disabled="creatingTranslation"
          @click="createTranslation('en')"
        >
          + New translation
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button data-testid="delete-page" class="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50" @click="deletePage">Delete</button>
        <button class="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50" @click="splitView = !splitView">
          {{ splitView ? 'Editor only' : 'Split view' }}
        </button>
        <button class="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50" @click="refreshKey++">↻</button>
        <button
          data-testid="save-page"
          class="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          :disabled="!pages.isDirty"
          @click="save"
        >Save</button>
      </div>
    </div>

    <div v-if="pages.currentPage" class="flex flex-1 overflow-hidden">
      <!-- Editor + meta panel -->
      <div :class="['flex flex-col', splitView ? 'w-1/2' : 'flex-1']">
        <!-- Tab bar -->
        <div class="flex border-b border-gray-200 bg-white flex-shrink-0">
          <button :class="['px-4 py-2 text-sm', activeTab === 'content' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeTab = 'content'">Content</button>
          <button :class="['px-4 py-2 text-sm', activeTab === 'meta' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeTab = 'meta'">Metadata</button>
          <button :class="['px-4 py-2 text-sm', activeTab === 'media' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeTab = 'media'">Media</button>
          <button :class="['px-4 py-2 text-sm', activeTab === 'history' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeTab = 'history'">History</button>
        </div>

        <!-- Content editor -->
        <div v-if="activeTab === 'content'" class="flex-1 overflow-hidden p-2">
          <MdxEditor :model-value="pages.currentPage.content" class="h-full" @update:model-value="onContentChange" />
        </div>

        <!-- Metadata panel — blueprint-driven -->
        <div v-else-if="activeTab === 'meta'" class="flex-1 overflow-y-auto p-4">
          <BlueprintForm
            v-if="blueprint"
            :blueprint="{ ...blueprint, tabs: blueprint.tabs?.filter(t => t.id !== 'content') }"
            :model-value="metaFormData"
            @update:model-value="metaFormData = $event"
          />
          <div v-else class="text-sm text-gray-400">Loading blueprint…</div>
        </div>

        <!-- Media panel -->
        <div v-else-if="activeTab === 'media'" class="flex-1 overflow-hidden">
          <PageMedia />
        </div>

        <!-- History panel -->
        <div v-else-if="activeTab === 'history'" class="flex-1 overflow-y-auto p-4">
          <PageRevisions :slug="slug" @restored="pages.loadPage(slug)" />
        </div>
      </div>

      <!-- Preview pane -->
      <div v-if="splitView" class="w-1/2 border-l border-gray-200 p-2">
        <PreviewFrame :slug="slug" :refresh-key="refreshKey" class="h-full" />
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
  </div>
</template>
