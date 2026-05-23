<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface FlexEntry {
  id: string
  typeName: string
  data: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{
  type: string
  limit?: number
  sort?: string
}>()

const API_URL = (import.meta as Record<string, unknown>).env
  ? ((import.meta as Record<string, Record<string, string>>).env['PUBLIC_API_URL'] ?? 'http://localhost:3000')
  : 'http://localhost:3000'

const entries = ref<FlexEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`${API_URL}/api/flex/${encodeURIComponent(props.type)}`)
    if (!res.ok) {
      error.value = `Failed to load ${props.type}: ${res.statusText}`
      return
    }
    const data = await res.json() as FlexEntry[]
    entries.value = data
  } catch {
    error.value = `Network error loading ${props.type}`
  } finally {
    loading.value = false
  }
})

const displayEntries = computed<FlexEntry[]>(() => {
  let list = [...entries.value]

  // Sort
  if (props.sort) {
    const field = props.sort
    list.sort((a, b) => {
      const av = String(a.data[field] ?? '')
      const bv = String(b.data[field] ?? '')
      return av.localeCompare(bv)
    })
  }

  // Limit
  if (props.limit && props.limit > 0) {
    list = list.slice(0, props.limit)
  }

  return list
})
</script>

<template>
  <div class="flex-collection">
    <div v-if="loading" class="flex-collection__loading">
      Loading...
    </div>

    <div v-else-if="error" class="flex-collection__error" role="alert">
      {{ error }}
    </div>

    <div v-else-if="displayEntries.length === 0" class="flex-collection__empty">
      No entries found.
    </div>

    <ul v-else class="flex-collection__list">
      <li
        v-for="entry in displayEntries"
        :key="entry.id"
        class="flex-collection__item"
      >
        <slot :entry="entry" :data="entry.data" :id="entry.id">
          <!-- Default slot: show all data fields as key/value pairs -->
          <dl class="flex-collection__item-data">
            <template v-for="(value, key) in entry.data" :key="key">
              <dt class="flex-collection__item-key">{{ key }}</dt>
              <dd class="flex-collection__item-value">{{ value }}</dd>
            </template>
          </dl>
        </slot>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.flex-collection {
  container-type: inline-size;
}

.flex-collection__loading,
.flex-collection__empty {
  color: #9ca3af;
  font-size: 0.875rem;
}

.flex-collection__error {
  color: #b91c1c;
  font-size: 0.875rem;
}

.flex-collection__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.flex-collection__item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.flex-collection__item:last-child {
  border-bottom: none;
}

.flex-collection__item-data {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  font-size: 0.875rem;
}

.flex-collection__item-key {
  font-weight: 500;
  color: #374151;
}

.flex-collection__item-value {
  color: #6b7280;
}
</style>
