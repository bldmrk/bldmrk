<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePageTree } from '@/composables/usePageTree.js'
import PageTreeItem from '@/components/PageTreeItem.vue'

const { tree, loading, load, deleteItem, createItem } = usePageTree()
const router = useRouter()
const contextMenu = ref<{ slug: string; x: number; y: number } | null>(null)

onMounted(load)

function onContextMenu(e: MouseEvent, slug: string) {
  e.preventDefault()
  contextMenu.value = { slug, x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenu.value = null
}

async function onDelete(slug: string) {
  if (confirm(`Delete "${slug}"?`)) await deleteItem(slug)
  closeContextMenu()
}

async function onAddChild(slug: string) {
  const title = prompt('Page title:')
  if (title) await createItem(slug, title)
  closeContextMenu()
}
</script>

<template>
  <div class="relative" @click="closeContextMenu">
    <div v-if="loading" class="text-sm text-gray-400 p-4">Loading...</div>

    <ul v-else class="space-y-0.5">
      <PageTreeItem
        v-for="node in tree"
        :key="node.slug"
        :node="node"
        @contextmenu="onContextMenu"
        @edit="(slug) => router.push(`/pages/${slug}`)"
        @add-child="onAddChild"
        @delete="onDelete"
      />
    </ul>

    <!-- Context menu -->
    <div
      v-if="contextMenu"
      :style="{ position: 'fixed', top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="z-50 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-36"
      @click.stop
    >
      <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" @click="router.push(`/pages/${contextMenu.slug}`)">Edit</button>
      <button class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" @click="onAddChild(contextMenu.slug)">Add child</button>
      <button class="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50" @click="onDelete(contextMenu.slug)">Delete</button>
    </div>
  </div>
</template>
