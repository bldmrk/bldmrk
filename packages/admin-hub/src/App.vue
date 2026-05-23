<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SitesList from './components/SitesList.vue'
import HubLogin from './components/HubLogin.vue'
import { useHubApi } from './composables/useHubApi.js'

const { getSites } = useHubApi()

const isAuthenticated = ref(false)
const checking = ref(true)

onMounted(async () => {
  try {
    await getSites()
    isAuthenticated.value = true
  } catch {
    isAuthenticated.value = false
  } finally {
    checking.value = false
  }
})
</script>

<template>
  <div v-if="checking" class="loading">Loading...</div>
  <HubLogin v-else-if="!isAuthenticated" @authenticated="isAuthenticated = true" />
  <SitesList v-else />
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f8f9fa;
  color: #212529;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 1.2rem;
  color: #6c757d;
}
</style>
