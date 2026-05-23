<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFlexTypes, useFlexEntries, useFlexMutations } from '@/composables/useFlex.js'
import type { FlexEntry, FlexType } from '@/composables/useFlex.js'

const props = defineProps<{ type: string }>()

const router = useRouter()

const { data: types } = useFlexTypes()
const { data: entries, isLoading } = useFlexEntries(props.type)
const { deleteEntry } = useFlexMutations(props.type)

const flexType = computed<FlexType | undefined>(() =>
  types.value?.find(t => t.name === props.type),
)

// Columns: prefer admin.list, fall back to labelField
const columns = computed<string[]>(() => {
  if (flexType.value?.admin?.list?.length) {
    return flexType.value.admin.list
  }
  return flexType.value ? [flexType.value.labelField] : []
})

// Sort state
const sortField = ref<string>(flexType.value?.admin?.sort ?? '')
const sortAsc = ref(true)

function toggleSort(field: string) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = true
  }
}

// Pagination
const PAGE_SIZE = 20
const currentPage = ref(1)

const sortedEntries = computed<FlexEntry[]>(() => {
  const list = [...(entries.value ?? [])]
  if (sortField.value) {
    list.sort((a, b) => {
      const av = String(a.data[sortField.value] ?? '')
      const bv = String(b.data[sortField.value] ?? '')
      return sortAsc.value ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }
  return list
})

const totalPages = computed(() => Math.ceil(sortedEntries.value.length / PAGE_SIZE))

const pagedEntries = computed<FlexEntry[]>(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sortedEntries.value.slice(start, start + PAGE_SIZE)
})

function getCellValue(entry: FlexEntry, col: string): string {
  const val = entry.data[col]
  if (val === undefined || val === null) return '—'
  return String(val)
}

function confirmDelete(id: string) {
  if (window.confirm('Delete this entry?')) {
    deleteEntry.mutate(id)
  }
}

function navigateToNew() {
  void router.push(`/flex/${props.type}/new`)
}

function navigateToEdit(id: string) {
  void router.push(`/flex/${props.type}/${id}`)
}
</script>

<template>
  <div class="p-8 max-w-5xl space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">
        {{ flexType?.label ?? type }}
      </h1>
      <button
        class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700"
        @click="navigateToNew"
      >
        New entry
      </button>
    </div>

    <div v-if="isLoading" class="text-sm text-gray-400">Loading entries...</div>

    <div v-else-if="!entries || entries.length === 0" class="text-sm text-gray-400">
      No entries yet. Click "New entry" to create the first one.
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-gray-500">
        {{ sortedEntries.length }} {{ sortedEntries.length === 1 ? 'entry' : 'entries' }}
      </p>

      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200">
              <th
                v-for="col in columns"
                :key="col"
                class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2 pr-4 cursor-pointer select-none hover:text-gray-700"
                @click="toggleSort(col)"
              >
                {{ col }}
                <span v-if="sortField === col" class="ml-1">
                  {{ sortAsc ? '▲' : '▼' }}
                </span>
              </th>
              <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in pagedEntries"
              :key="entry.id"
              class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              @click="navigateToEdit(entry.id)"
            >
              <td
                v-for="col in columns"
                :key="col"
                class="py-2 pr-4 text-gray-700 max-w-xs truncate"
              >
                {{ getCellValue(entry, col) }}
              </td>
              <td class="py-2 whitespace-nowrap" @click.stop>
                <button
                  class="text-blue-600 hover:text-blue-800 text-xs mr-3"
                  @click="navigateToEdit(entry.id)"
                >
                  Edit
                </button>
                <button
                  class="text-red-500 hover:text-red-700 text-xs"
                  @click="confirmDelete(entry.id)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center gap-2 pt-2">
        <button
          class="text-sm px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          Prev
        </button>
        <span class="text-sm text-gray-500">
          Page {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          class="text-sm px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
