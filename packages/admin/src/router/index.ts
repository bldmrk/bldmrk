import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/Login.vue') },
    { path: '/', component: () => import('@/views/Dashboard.vue'), meta: { requiresAuth: true } },
    { path: '/pages', component: () => import('@/views/pages/PageList.vue'), meta: { requiresAuth: true } },
    { path: '/pages/:slug', component: () => import('@/views/pages/PageEdit.vue'), meta: { requiresAuth: true } },
    { path: '/media', component: () => import('@/views/MediaBrowser.vue'), meta: { requiresAuth: true } },
    { path: '/plugins', component: () => import('@/views/Plugins.vue'), meta: { requiresAuth: true } },
    { path: '/settings', component: () => import('@/views/Settings.vue'), meta: { requiresAuth: true } },
    { path: '/users', component: () => import('@/views/Users.vue'), meta: { requiresAuth: true } },
    { path: '/taxonomy', component: () => import('@/views/Taxonomy.vue'), meta: { requiresAuth: true } },
    { path: '/forms', component: () => import('@/views/Forms.vue'), meta: { requiresAuth: true } },
    { path: '/flex/:type', component: () => import('@/views/flex/FlexList.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/flex/:type/new', component: () => import('@/views/flex/FlexEdit.vue'), props: (route) => ({ type: route.params['type'], id: 'new' }), meta: { requiresAuth: true } },
    { path: '/flex/:type/:id', component: () => import('@/views/flex/FlexEdit.vue'), props: true, meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export { router }
