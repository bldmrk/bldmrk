<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MediaBrowser from '@/components/MediaBrowser.vue'

const route = useRoute()
const pageId = computed(() => route.params.slug as string)
</script>

<template>
  <div class="h-full overflow-hidden">
    <MediaBrowser :page-id="pageId" />
  </div>
</template>
