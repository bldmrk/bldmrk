<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from '@/composables/useApi.js'

interface FormField {
  name: string
  type: string
  label: string
  required: boolean
}

interface FormBlueprint {
  name: string
  fields: FormField[]
  honeypot: string
  rateLimit: number
  actions: { redirect?: string }
}

interface Submission {
  id: string
  data: Record<string, unknown>
}

const api = useApi()
const queryClient = useQueryClient()

const selectedForm = ref<string | null>(null)

const { data: forms, isLoading: formsLoading } = useQuery<FormBlueprint[]>({
  queryKey: ['forms'],
  queryFn: () => api.get<FormBlueprint[]>('/api/forms'),
})

const { data: submissions, isLoading: submissionsLoading } = useQuery<Submission[]>({
  queryKey: computed(() => ['form-submissions', selectedForm.value]),
  queryFn: () => api.get<Submission[]>(`/api/forms/${encodeURIComponent(selectedForm.value!)}/submissions`),
  enabled: computed(() => selectedForm.value !== null),
})

const { mutate: deleteSubmission } = useMutation({
  mutationFn: ({ formName, id }: { formName: string; id: string }) =>
    api.del(`/api/forms/${encodeURIComponent(formName)}/submissions/${encodeURIComponent(id)}`),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['form-submissions', selectedForm.value] })
  },
})

function selectForm(name: string) {
  selectedForm.value = selectedForm.value === name ? null : name
}

function formatDate(id: string): string {
  // id is an ISO timestamp with dashes replacing colons/dots
  // e.g. 2024-01-15T10-30-00-000Z
  try {
    const iso = id.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
    return new Date(iso).toLocaleString()
  } catch {
    return id
  }
}

function downloadCsv() {
  if (!submissions.value || !selectedForm.value) return

  const rows = submissions.value
  if (rows.length === 0) return

  // Collect all field keys
  const allKeys = Array.from(
    new Set(rows.flatMap(s => Object.keys(s.data as Record<string, unknown>)))
  )

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const header = ['id', ...allKeys].map(escape).join(',')
  const lines = rows.map(s =>
    [s.id, ...allKeys.map(k => escape((s.data as Record<string, unknown>)[k]))].join(',')
  )

  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedForm.value}-submissions.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function confirmDelete(formName: string, id: string) {
  if (window.confirm('Delete this submission?')) {
    deleteSubmission({ formName, id })
  }
}
</script>

<template>
  <div class="p-8 max-w-5xl space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Forms</h1>

    <div v-if="formsLoading" class="text-sm text-gray-400">Loading forms...</div>

    <div v-else-if="!forms || forms.length === 0" class="text-sm text-gray-400">
      No forms found. Create a YAML blueprint in <code>content/forms/</code>.
    </div>

    <div v-else class="space-y-4">
      <p class="text-sm text-gray-500">{{ forms.length }} form{{ forms.length !== 1 ? 's' : '' }} found.</p>

      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2 pr-4">Name</th>
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2 pr-4">Fields</th>
            <th class="text-left font-semibold text-gray-500 uppercase tracking-wide text-xs py-2">Rate Limit / hr</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="form in forms" :key="form.name">
            <tr
              class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-blue-50 hover:bg-blue-50': selectedForm === form.name }"
              @click="selectForm(form.name)"
            >
              <td class="py-2 pr-4">
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full transition-transform"
                    :class="selectedForm === form.name ? 'bg-blue-500 scale-125' : 'bg-gray-300'"
                  />
                  <span class="font-medium text-gray-900">{{ form.name }}</span>
                </span>
              </td>
              <td class="py-2 pr-4 text-gray-500">{{ form.fields.length }}</td>
              <td class="py-2 text-gray-500">{{ form.rateLimit }}</td>
            </tr>

            <!-- Submissions panel for selected form -->
            <tr v-if="selectedForm === form.name" :key="`${form.name}-submissions`">
              <td colspan="3" class="pb-4 pt-2 px-2">
                <div class="rounded-md border border-blue-100 bg-blue-50 p-4">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-sm font-semibold text-blue-700">
                      Submissions for "{{ form.name }}"
                    </p>
                    <button
                      class="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1"
                      @click.stop="downloadCsv"
                    >
                      Download CSV
                    </button>
                  </div>

                  <div v-if="submissionsLoading" class="text-xs text-gray-400">Loading submissions...</div>

                  <div v-else-if="!submissions || submissions.length === 0" class="text-xs text-gray-400">
                    No submissions yet.
                  </div>

                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse">
                      <thead>
                        <tr class="border-b border-blue-200">
                          <th class="text-left py-1.5 pr-3 font-semibold text-blue-600">Date</th>
                          <th
                            v-for="field in form.fields"
                            :key="field.name"
                            class="text-left py-1.5 pr-3 font-semibold text-blue-600"
                          >
                            {{ field.label }}
                          </th>
                          <th class="text-left py-1.5 font-semibold text-blue-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="sub in submissions"
                          :key="sub.id"
                          class="border-b border-blue-100"
                        >
                          <td class="py-1.5 pr-3 text-gray-500 font-mono whitespace-nowrap">
                            {{ formatDate(sub.id) }}
                          </td>
                          <td
                            v-for="field in form.fields"
                            :key="field.name"
                            class="py-1.5 pr-3 text-gray-700 max-w-xs truncate"
                          >
                            {{ (sub.data as Record<string, unknown>)[field.name] ?? '—' }}
                          </td>
                          <td class="py-1.5">
                            <button
                              class="text-red-500 hover:text-red-700 text-xs"
                              @click.stop="confirmDelete(form.name, sub.id)"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
