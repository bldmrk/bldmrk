<script setup lang="ts">
import { ref } from 'vue'
import type { TreeNode } from '@/composables/usePageTree.js'

const props = defineProps<{ node: TreeNode }>()
const emit = defineEmits<{
  contextmenu: [e: MouseEvent, slug: string]
  edit: [slug: string]
  'add-child': [slug: string]
  delete: [slug: string]
}>()

const expanded = ref(true)
</script>

<template>
  <li>
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group cursor-pointer"
      @contextmenu="emit('contextmenu', $event, node.slug)"
    >
      <button
        v-if="node.children.length"
        class="text-gray-400 w-4 text-xs"
        @click.stop="expanded = !expanded"
      >{{ expanded ? '▾' : '▸' }}</button>
      <span v-else class="w-4" />

      <span class="text-sm text-gray-900 flex-1 truncate">{{ node.meta.title }}</span>

      <span
        :class="['text-xs px-1.5 py-0.5 rounded', node.meta.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500']"
      >{{ node.meta.published ? 'pub' : 'draft' }}</span>

      <div class="hidden group-hover:flex gap-1">
        <button class="text-gray-400 hover:text-gray-900 text-xs px-1" @click.stop="emit('edit', node.slug)">✏</button>
        <button class="text-gray-400 hover:text-gray-900 text-xs px-1" @click.stop="emit('add-child', node.slug)">＋</button>
        <button class="text-gray-400 hover:text-red-600 text-xs px-1" @click.stop="emit('delete', node.slug)">✕</button>
      </div>
    </div>

    <ul v-if="expanded && node.children.length" class="ml-4 space-y-0.5">
      <PageTreeItem
        v-for="child in node.children"
        :key="child.slug"
        :node="child"
        @contextmenu="emit('contextmenu', $event, child.slug)"
        @edit="emit('edit', $event)"
        @add-child="emit('add-child', $event)"
        @delete="emit('delete', $event)"
      />
    </ul>
  </li>
</template>
