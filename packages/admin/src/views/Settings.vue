<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useApi } from '@/composables/useApi.js'
import BlueprintForm from '@/components/blueprint/BlueprintForm.vue'
import { useBlueprintForConfig } from '@/composables/useBlueprint.js'

const api = useApi()
const activeConfigTab = ref<'site' | 'system'>('site')
const dirty = ref(false)
const saving = ref(false)
const savedMsg = ref(false)

const siteData = ref<Record<string, unknown>>({})
const systemData = ref<Record<string, unknown>>({})

const { data: siteBlueprintRaw } = useBlueprintForConfig('site')
const { data: systemBlueprintRaw } = useBlueprintForConfig('system')

const siteBlueprint = computed(() => siteBlueprintRaw.value ?? undefined)
const systemBlueprint = computed(() => systemBlueprintRaw.value ?? undefined)

async function loadConfig() {
  const [site, system] = await Promise.all([
    api.get<Record<string, unknown>>('/api/config/site'),
    api.get<Record<string, unknown>>('/api/config/system'),
  ])
  siteData.value = site
  systemData.value = system
  dirty.value = false
}

void loadConfig()

let watchReady = false
watch([siteData, systemData], () => {
  if (!watchReady) { watchReady = true; return }
  dirty.value = true
}, { deep: true })

async function save() {
  saving.value = true
  try {
    if (activeConfigTab.value === 'site') {
      await api.put('/api/config/site', siteData.value)
    } else {
      await api.put('/api/config/system', systemData.value)
    }
    dirty.value = false
    savedMsg.value = true
    setTimeout(() => { savedMsg.value = false }, 2000)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-2xl space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      <div class="flex items-center gap-2">
        <span v-if="savedMsg" data-testid="settings-saved" class="text-sm text-green-600">Saved!</span>
        <button
          data-testid="settings-save"
          class="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          :disabled="!dirty || saving"
          @click="save"
        >{{ saving ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>

    <div class="flex gap-1 border-b border-gray-200">
      <button :class="['px-4 py-2 text-sm', activeConfigTab === 'site' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeConfigTab = 'site'">Site</button>
      <button :class="['px-4 py-2 text-sm', activeConfigTab === 'system' ? 'border-b-2 border-gray-900 font-medium' : 'text-gray-500']" @click="activeConfigTab = 'system'">System</button>
    </div>

    <div v-if="activeConfigTab === 'site'">
      <BlueprintForm
        v-if="siteBlueprint"
        :blueprint="siteBlueprint"
        :model-value="siteData"
        @update:model-value="siteData = $event"
      />
      <div v-else class="text-sm text-gray-400">Loading…</div>
    </div>

    <div v-else>
      <BlueprintForm
        v-if="systemBlueprint"
        :blueprint="systemBlueprint"
        :model-value="systemData"
        @update:model-value="systemData = $event"
      />
      <div v-else class="text-sm text-gray-400">Loading…</div>
    </div>
  </div>
</template>
