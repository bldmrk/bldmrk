<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMediaStore, type MediaObject } from '@/stores/media.js'

const props = defineProps<{ pageId?: string }>()
const media = useMediaStore()
const view = ref<'grid' | 'list'>('grid')
const lightbox = ref<MediaObject | null>(null)
const dragOver = ref(false)
const uploading = ref(false)
const contextItem = ref<{ item: MediaObject; x: number; y: number } | null>(null)

onMounted(() => media.loadMedia(props.pageId))

async function handleFiles(files: FileList | File[]) {
  uploading.value = true
  try {
    await Promise.all(Array.from(files).map((f) => media.uploadMedia(f, props.pageId)))
  } finally {
    uploading.value = false
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files)
}

function onFileInput(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) handleFiles(files)
}

function onContextMenu(e: MouseEvent, item: MediaObject) {
  e.preventDefault()
  contextItem.value = { item, x: e.clientX, y: e.clientY }
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url)
  contextItem.value = null
}

async function deleteItem(id: string) {
  if (confirm('Delete this file?')) await media.deleteMedia(id)
  contextItem.value = null
}

function formatSize(bytes?: number) {
  if (!bytes) return '—'
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function isImage(item: MediaObject) {
  return item.mimeType?.startsWith('image/') ?? item.filename.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)
}
</script>

<template>
  <div class="flex flex-col h-full" @click="contextItem = null" @keydown.escape="contextItem = null">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-200 flex-shrink-0">
      <input
        v-model="media.searchQuery"
        placeholder="Search files…"
        class="flex-1 border rounded px-3 py-1.5 text-sm"
      />
      <button :class="['px-2 py-1.5 text-sm rounded border', view === 'grid' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200']" @click="view = 'grid'">Grid</button>
      <button :class="['px-2 py-1.5 text-sm rounded border', view === 'list' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200']" @click="view = 'list'">List</button>
      <label class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700">
        Upload
        <input data-testid="media-upload-input" type="file" multiple accept="image/*" class="hidden" @change="onFileInput" />
      </label>
    </div>

    <!-- Drop zone -->
    <div
      class="flex-1 overflow-auto relative"
      :class="dragOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div v-if="uploading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
        <span class="text-sm text-gray-600">Uploading…</span>
      </div>

      <div v-if="media.loading" class="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div>

      <!-- Grid view -->
      <div v-else-if="view === 'grid'" class="p-4 grid grid-cols-4 gap-3">
        <div
          v-for="item in media.filteredItems"
          :key="item.id"
          class="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square cursor-pointer"
          @click="isImage(item) && (lightbox = item)"
          @contextmenu="onContextMenu($event, item)"
        >
          <img v-if="isImage(item)" :src="item.webpUrl ?? item.url" :alt="item.filename" class="w-full h-full object-cover" />
          <div v-else class="flex items-center justify-center h-full text-3xl text-gray-300">📄</div>
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            <span class="text-white text-xs text-center px-2 truncate w-full text-center">{{ item.filename }}</span>
            <span class="text-white/70 text-xs">{{ formatSize(item.size) }}</span>
          </div>
        </div>
      </div>

      <!-- List view -->
      <table v-else class="w-full text-sm">
        <thead class="border-b border-gray-200">
          <tr class="text-left text-gray-500 text-xs uppercase">
            <th class="px-4 py-2 font-medium">Name</th>
            <th class="px-4 py-2 font-medium">Type</th>
            <th class="px-4 py-2 font-medium">Size</th>
            <th class="px-4 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="item in media.filteredItems"
            :key="item.id"
            class="hover:bg-gray-50 cursor-pointer"
            @contextmenu="onContextMenu($event, item)"
          >
            <td class="px-4 py-2 text-gray-900">{{ item.filename }}</td>
            <td class="px-4 py-2 text-gray-500">{{ item.mimeType ?? '—' }}</td>
            <td class="px-4 py-2 text-gray-500">{{ formatSize(item.size) }}</td>
            <td class="px-4 py-2 text-gray-400 text-xs">{{ item.createdAt?.slice(0, 10) ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Context menu -->
    <div
      v-if="contextItem"
      :style="{ position: 'fixed', top: `${contextItem.y}px`, left: `${contextItem.x}px` }"
      class="z-50 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-40"
      @click.stop
    >
      <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" @click="copyUrl(contextItem.item.url)">Copy URL</button>
      <button class="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50" @click="deleteItem(contextItem.item.id)">Delete</button>
    </div>

    <!-- Lightbox -->
    <div v-if="lightbox" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" @click="lightbox = null">
      <img :src="lightbox.url" :alt="lightbox.filename" class="max-w-[90vw] max-h-[90vh] object-contain rounded" />
    </div>
  </div>
</template>
