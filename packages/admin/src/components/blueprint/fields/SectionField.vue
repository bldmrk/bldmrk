<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <fieldset class="border border-gray-200 rounded p-4 space-y-4">
    <legend class="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ label }}</legend>
    <slot />
  </fieldset>
</template>
