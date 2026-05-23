<script setup lang="ts">
defineProps<{
  tags: string[]
}>()

function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5" aria-label="Page tags">
    <a
      v-for="tag in tags"
      :key="tag"
      :href="`/tags/${tagSlug(tag)}`"
      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors no-underline"
    >
      #{{ tag }}
    </a>
  </div>
</template>
