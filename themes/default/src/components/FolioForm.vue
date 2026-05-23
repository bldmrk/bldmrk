<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface FieldOption {
  value: string
  label: string
}

interface FieldValidation {
  min?: number
  max?: number
  pattern?: string
}

interface FormField {
  name: string
  type: 'text' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'hidden' | 'file'
  label: string
  required: boolean
  placeholder?: string
  options?: FieldOption[]
  validation?: FieldValidation
}

interface FormBlueprint {
  name: string
  fields: FormField[]
  honeypot: string
  rateLimit: number
  actions: { redirect?: string }
}

interface ValidationError {
  field: string
  message: string
}

const props = defineProps<{
  formName: string
}>()

const API_URL = (import.meta as Record<string, unknown>).env
  ? ((import.meta as Record<string, Record<string, string>>).env['PUBLIC_API_URL'] ?? 'http://localhost:3000')
  : 'http://localhost:3000'

const blueprint = ref<FormBlueprint | null>(null)
const loadError = ref<string | null>(null)
const formData = ref<Record<string, string | boolean>>({})
const fieldErrors = ref<Record<string, string>>({})
const submitting = ref(false)
const submitted = ref(false)
const submitError = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`${API_URL}/api/forms/${encodeURIComponent(props.formName)}`)
    if (!res.ok) {
      loadError.value = `Form not found: ${props.formName}`
      return
    }
    blueprint.value = await res.json() as FormBlueprint

    // Initialize form data
    for (const field of blueprint.value.fields) {
      if (field.type === 'checkbox') {
        formData.value[field.name] = false
      } else {
        formData.value[field.name] = ''
      }
    }
  } catch {
    loadError.value = 'Failed to load form. Please try again later.'
  }
})

const fields = computed(() => blueprint.value?.fields ?? [])
const honeypotField = computed(() => blueprint.value?.honeypot ?? '_gotcha')

function validateField(field: FormField): string | null {
  const value = formData.value[field.name]
  const strValue = String(value ?? '')
  const isEmpty = value === '' || value === false || value === undefined

  if (field.required && isEmpty) {
    return `${field.label} is required`
  }

  if (isEmpty) return null

  if (field.type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(strValue)) {
      return `${field.label} must be a valid email address`
    }
  }

  if (field.validation) {
    const { min, max, pattern } = field.validation

    if (min !== undefined && strValue.length < min) {
      return `${field.label} must be at least ${min} characters`
    }

    if (max !== undefined && strValue.length > max) {
      return `${field.label} must be at most ${max} characters`
    }

    if (pattern !== undefined) {
      if (!new RegExp(pattern).test(strValue)) {
        return `${field.label} does not match the required format`
      }
    }
  }

  return null
}

function validateAll(): boolean {
  const errors: Record<string, string> = {}
  for (const field of fields.value) {
    const err = validateField(field)
    if (err) errors[field.name] = err
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!blueprint.value) return
  if (!validateAll()) return

  submitting.value = true
  submitError.value = null

  try {
    const payload: Record<string, unknown> = { ...formData.value }

    const res = await fetch(`${API_URL}/api/forms/${encodeURIComponent(props.formName)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 422) {
      const body = await res.json() as { errors: ValidationError[] }
      const errors: Record<string, string> = {}
      for (const e of body.errors) {
        errors[e.field] = e.message
      }
      fieldErrors.value = errors
      return
    }

    if (res.status === 429) {
      submitError.value = 'Too many submissions. Please try again later.'
      return
    }

    if (!res.ok) {
      submitError.value = 'Submission failed. Please try again.'
      return
    }

    submitted.value = true

    // Redirect if configured
    if (blueprint.value.actions.redirect) {
      window.location.href = blueprint.value.actions.redirect
    }
  } catch {
    submitError.value = 'A network error occurred. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bldmrk-form">
    <div v-if="loadError" class="bldmrk-form__error" role="alert">
      {{ loadError }}
    </div>

    <div v-else-if="submitted" class="bldmrk-form__success" role="status">
      <p>Thank you! Your submission has been received.</p>
    </div>

    <form v-else-if="blueprint" @submit.prevent="handleSubmit" novalidate>
      <!-- Honeypot field (hidden from real users) -->
      <div style="display:none" aria-hidden="true">
        <label :for="honeypotField">Leave this field empty</label>
        <input
          :id="honeypotField"
          :name="honeypotField"
          type="text"
          tabindex="-1"
          autocomplete="off"
          v-model="(formData as Record<string, string>)[honeypotField]"
        />
      </div>

      <div
        v-for="field in fields"
        :key="field.name"
        class="bldmrk-form__field"
        :class="{ 'bldmrk-form__field--error': fieldErrors[field.name] }"
      >
        <!-- Hidden fields have no label -->
        <label
          v-if="field.type !== 'hidden'"
          :for="`field-${field.name}`"
          class="bldmrk-form__label"
        >
          {{ field.label }}
          <span v-if="field.required" class="bldmrk-form__required" aria-label="required">*</span>
        </label>

        <!-- Text / Email / Hidden -->
        <input
          v-if="['text', 'email', 'hidden'].includes(field.type)"
          :id="`field-${field.name}`"
          :name="field.name"
          :type="field.type"
          :placeholder="field.placeholder"
          :required="field.required"
          :aria-describedby="fieldErrors[field.name] ? `error-${field.name}` : undefined"
          :aria-invalid="!!fieldErrors[field.name]"
          class="bldmrk-form__input"
          v-model="(formData as Record<string, string>)[field.name]"
        />

        <!-- Textarea -->
        <textarea
          v-else-if="field.type === 'textarea'"
          :id="`field-${field.name}`"
          :name="field.name"
          :placeholder="field.placeholder"
          :required="field.required"
          :aria-describedby="fieldErrors[field.name] ? `error-${field.name}` : undefined"
          :aria-invalid="!!fieldErrors[field.name]"
          class="bldmrk-form__textarea"
          rows="5"
          v-model="(formData as Record<string, string>)[field.name]"
        />

        <!-- Select -->
        <select
          v-else-if="field.type === 'select'"
          :id="`field-${field.name}`"
          :name="field.name"
          :required="field.required"
          :aria-describedby="fieldErrors[field.name] ? `error-${field.name}` : undefined"
          :aria-invalid="!!fieldErrors[field.name]"
          class="bldmrk-form__select"
          v-model="(formData as Record<string, string>)[field.name]"
        >
          <option value="">— Select —</option>
          <option
            v-for="opt in field.options ?? []"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>

        <!-- Checkbox -->
        <label
          v-else-if="field.type === 'checkbox'"
          :for="`field-${field.name}`"
          class="bldmrk-form__checkbox-label"
        >
          <input
            :id="`field-${field.name}`"
            :name="field.name"
            type="checkbox"
            :required="field.required"
            class="bldmrk-form__checkbox"
            v-model="(formData as Record<string, boolean>)[field.name]"
          />
          {{ field.label }}
        </label>

        <!-- Radio group -->
        <fieldset v-else-if="field.type === 'radio'" class="bldmrk-form__radio-group">
          <legend class="sr-only">{{ field.label }}</legend>
          <label
            v-for="opt in field.options ?? []"
            :key="opt.value"
            class="bldmrk-form__radio-label"
          >
            <input
              :name="field.name"
              type="radio"
              :value="opt.value"
              :required="field.required"
              class="bldmrk-form__radio"
              v-model="(formData as Record<string, string>)[field.name]"
            />
            {{ opt.label }}
          </label>
        </fieldset>

        <!-- File input -->
        <input
          v-else-if="field.type === 'file'"
          :id="`field-${field.name}`"
          :name="field.name"
          type="file"
          :required="field.required"
          class="bldmrk-form__file"
        />

        <!-- Field error -->
        <p
          v-if="fieldErrors[field.name]"
          :id="`error-${field.name}`"
          class="bldmrk-form__field-error"
          role="alert"
        >
          {{ fieldErrors[field.name] }}
        </p>
      </div>

      <!-- Global submit error -->
      <p v-if="submitError" class="bldmrk-form__submit-error" role="alert">
        {{ submitError }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="bldmrk-form__submit"
      >
        {{ submitting ? 'Sending...' : 'Submit' }}
      </button>
    </form>

    <div v-else class="bldmrk-form__loading">
      Loading form...
    </div>
  </div>
</template>

<style scoped>
.bldmrk-form {
  max-width: 600px;
}

.bldmrk-form__field {
  margin-bottom: 1.25rem;
}

.bldmrk-form__label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: #374151;
  font-size: 0.875rem;
}

.bldmrk-form__required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.bldmrk-form__input,
.bldmrk-form__textarea,
.bldmrk-form__select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #111827;
  background: #fff;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.bldmrk-form__input:focus,
.bldmrk-form__textarea:focus,
.bldmrk-form__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.bldmrk-form__field--error .bldmrk-form__input,
.bldmrk-form__field--error .bldmrk-form__textarea,
.bldmrk-form__field--error .bldmrk-form__select {
  border-color: #ef4444;
}

.bldmrk-form__textarea {
  resize: vertical;
}

.bldmrk-form__checkbox-label,
.bldmrk-form__radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.bldmrk-form__radio-group {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bldmrk-form__field-error,
.bldmrk-form__submit-error {
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.bldmrk-form__submit-error {
  margin-bottom: 1rem;
}

.bldmrk-form__submit {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 0.375rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.bldmrk-form__submit:hover:not(:disabled) {
  background: #2563eb;
}

.bldmrk-form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.bldmrk-form__success {
  padding: 1rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 0.375rem;
  color: #15803d;
  font-size: 0.875rem;
}

.bldmrk-form__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 0.375rem;
  color: #b91c1c;
  font-size: 0.875rem;
}

.bldmrk-form__loading {
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>
