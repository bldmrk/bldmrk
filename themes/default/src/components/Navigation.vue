<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface NavPage {
  slug: string
  data: { title: string; menu?: { visible?: boolean; label?: string } }
}

const API_URL = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'

const pages = ref<NavPage[]>([])
const mobileOpen = ref(false)
const currentPath = ref('')

onMounted(async () => {
  currentPath.value = window.location.pathname
  try {
    const res = await fetch(`${API_URL}/api/pages`)
    if (res.ok) {
      const all: NavPage[] = await res.json()
      pages.value = all.filter((p) => p.data.menu?.visible !== false)
    }
  } catch {
    // API unreachable — show no nav items, no crash
  }
})

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}

function closeMobile() {
  mobileOpen.value = false
}

function isActive(slug: string): boolean {
  const href = slug === 'home' ? '/' : `/${slug}`
  return currentPath.value === href || currentPath.value.startsWith(`/${slug}/`)
}

function href(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`
}
</script>

<template>
  <header class="border-b border-gray-200 bg-white sticky top-0 z-30">
    <nav class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="font-bold text-lg text-gray-900 no-underline">bldmrk</a>

      <!-- Desktop links -->
      <ul class="hidden md:flex gap-6 list-none m-0 p-0">
        <li v-for="page in pages" :key="page.slug">
          <a
            :href="href(page.slug)"
            :class="[
              'no-underline text-sm font-medium transition-colors',
              isActive(page.slug)
                ? 'text-gray-900 font-semibold'
                : 'text-gray-500 hover:text-gray-900',
            ]"
          >
            {{ page.data.menu?.label ?? page.data.title }}
          </a>
        </li>
      </ul>

      <!-- Hamburger (mobile) -->
      <button
        class="md:hidden flex flex-col gap-1.5 p-1 rounded cursor-pointer border-none bg-transparent"
        :aria-expanded="mobileOpen"
        aria-label="Toggle menu"
        @click="toggleMobile"
      >
        <span class="block w-6 h-0.5 bg-gray-700 transition-transform" :class="{ 'rotate-45 translate-y-2': mobileOpen }" />
        <span class="block w-6 h-0.5 bg-gray-700 transition-opacity" :class="{ 'opacity-0': mobileOpen }" />
        <span class="block w-6 h-0.5 bg-gray-700 transition-transform" :class="{ '-rotate-45 -translate-y-2': mobileOpen }" />
      </button>
    </nav>

    <!-- Mobile dropdown -->
    <div v-if="mobileOpen" class="md:hidden border-t border-gray-100 bg-white">
      <ul class="list-none m-0 p-0 px-6 py-3 flex flex-col gap-3">
        <li v-for="page in pages" :key="page.slug">
          <a
            :href="href(page.slug)"
            :class="[
              'no-underline text-base',
              isActive(page.slug) ? 'text-gray-900 font-semibold' : 'text-gray-600',
            ]"
            @click="closeMobile"
          >
            {{ page.data.menu?.label ?? page.data.title }}
          </a>
        </li>
      </ul>
    </div>
  </header>
</template>
