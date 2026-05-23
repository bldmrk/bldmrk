<script setup lang="ts">
import MediaBrowser from '@/components/MediaBrowser.vue'
</script>

<template>
  <div class="flex flex-col h-screen">
    <div class="px-8 py-4 border-b border-gray-200 flex-shrink-0">
      <h1 class="text-2xl font-bold text-gray-900">Media</h1>
    </div>
    <div class="flex-1 overflow-hidden">
      <MediaBrowser />
    </div>
  </div>
</template>
