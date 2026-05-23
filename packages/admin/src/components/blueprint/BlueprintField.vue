<script setup lang="ts">
import { computed } from 'vue'
import type { BlueprintField } from '@/composables/useBlueprint.js'
import MarkdownField from './fields/MarkdownField.vue'
import SlugField from './fields/SlugField.vue'
import TagsField from './fields/TagsField.vue'
import SectionField from './fields/SectionField.vue'
import TemplateField from './fields/TemplateField.vue'
import DatetimeField from './fields/DatetimeField.vue'
import FileField from './fields/FileField.vue'

const props = defineProps<{
  field: BlueprintField
  modelValue: unknown
  formData: Record<string, unknown>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const isVisible = computed(() => {
  if (!props.field.condition) return true
  return props.formData[props.field.condition.field] === props.field.condition.value
})

function update(val: unknown) {
  emit('update:modelValue', val)
}

const strVal = computed(() => String(props.modelValue ?? ''))
const numVal = computed(() => props.modelValue as number | null)
const boolVal = computed(() => Boolean(props.modelValue))
const arrVal = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []) as string[])
</script>

<template>
  <div v-if="isVisible" class="space-y-1">
    <!-- section: visual group header with nested fields via slot -->
    <SectionField v-if="field.type === 'section'" :label="field.label">
      <slot name="section-fields" />
    </SectionField>

    <template v-else>
      <!-- Label (not shown for boolean which handles its own label) -->
      <label v-if="field.type !== 'boolean'" :for="`bp-${field.name}`" class="block text-sm font-medium text-gray-700">
        {{ field.label }}
        <span v-if="field.required" class="text-red-500 ml-1">*</span>
      </label>

      <!-- text / hidden -->
      <input
        v-if="field.type === 'text' || field.type === 'hidden'"
        :id="`bp-${field.name}`"
        :value="strVal"
        :type="field.type === 'hidden' ? 'hidden' : 'text'"
        :placeholder="field.placeholder"
        :required="field.required"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        @input="update(($event.target as HTMLInputElement).value)"
      />

      <!-- textarea -->
      <textarea
        v-else-if="field.type === 'textarea'"
        :id="`bp-${field.name}`"
        :value="strVal"
        rows="3"
        :placeholder="field.placeholder"
        :required="field.required"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-vertical"
        @input="update(($event.target as HTMLTextAreaElement).value)"
      />

      <!-- number -->
      <input
        v-else-if="field.type === 'number'"
        :id="`bp-${field.name}`"
        :value="numVal"
        type="number"
        :required="field.required"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        @input="update(Number(($event.target as HTMLInputElement).value))"
      />

      <!-- boolean -->
      <label v-else-if="field.type === 'boolean'" :for="`bp-${field.name}`" class="flex items-center gap-2 cursor-pointer">
        <input
          :id="`bp-${field.name}`"
          :checked="boolVal"
          type="checkbox"
          class="rounded border-gray-300"
          @change="update(($event.target as HTMLInputElement).checked)"
        />
        <span class="text-sm text-gray-700">{{ field.label }}</span>
      </label>

      <!-- date -->
      <input
        v-else-if="field.type === 'date'"
        :id="`bp-${field.name}`"
        :value="strVal"
        type="date"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        @input="update(($event.target as HTMLInputElement).value)"
      />

      <!-- datetime -->
      <DatetimeField
        v-else-if="field.type === 'datetime'"
        :model-value="strVal"
        @update:model-value="update"
      />

      <!-- select -->
      <select
        v-else-if="field.type === 'select'"
        :id="`bp-${field.name}`"
        :value="strVal"
        :required="field.required"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        @change="update(($event.target as HTMLSelectElement).value)"
      >
        <option value="">— Select —</option>
        <option v-for="opt in field.options ?? []" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <!-- image -->
      <div v-else-if="field.type === 'image'" class="space-y-2">
        <div v-if="strVal" class="flex items-center gap-3">
          <img :src="strVal" :alt="field.label" class="w-24 h-24 object-cover rounded border border-gray-200" />
          <button type="button" class="text-xs text-red-500 hover:text-red-700" @click="update('')">Remove</button>
        </div>
        <input
          :id="`bp-${field.name}`"
          :value="strVal"
          type="text"
          :placeholder="field.placeholder ?? 'Image URL'"
          class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono text-xs"
          @input="update(($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- file -->
      <FileField
        v-else-if="field.type === 'file'"
        :model-value="strVal"
        @update:model-value="update"
      />

      <!-- list -->
      <input
        v-else-if="field.type === 'list'"
        :id="`bp-${field.name}`"
        :value="arrVal.join(', ')"
        type="text"
        placeholder="comma-separated values"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        @input="update(($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean))"
      />

      <!-- tags -->
      <TagsField
        v-else-if="field.type === 'tags'"
        :model-value="arrVal"
        @update:model-value="update"
      />

      <!-- slug -->
      <SlugField
        v-else-if="field.type === 'slug'"
        :model-value="strVal"
        :source="field.source"
        :form-data="formData"
        @update:model-value="update"
      />

      <!-- template -->
      <TemplateField
        v-else-if="field.type === 'template'"
        :model-value="strVal"
        @update:model-value="update"
      />

      <!-- markdown -->
      <MarkdownField
        v-else-if="field.type === 'markdown'"
        :model-value="strVal"
        @update:model-value="update"
      />

      <!-- object: JSON textarea -->
      <textarea
        v-else-if="field.type === 'object'"
        :id="`bp-${field.name}`"
        :value="JSON.stringify(modelValue ?? {}, null, 2)"
        rows="4"
        class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono resize-vertical"
        @change="e => { try { update(JSON.parse((e.target as HTMLTextAreaElement).value)) } catch { /* keep invalid JSON */ } }"
      />

      <!-- help text -->
      <p v-if="field.help" class="text-xs text-gray-400">{{ field.help }}</p>
    </template>
  </div>
</template>
