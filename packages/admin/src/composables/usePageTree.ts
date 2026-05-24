import { ref } from 'vue'
import { useApi } from './useApi.js'

export interface PageObject {
  slug: string
  meta: { title: string; template?: string; published?: boolean; date?: string }
  children?: PageObject[]
}

export interface TreeNode extends PageObject {
  children: TreeNode[]
}

function buildTree(pages: PageObject[]): TreeNode[] {
  // Pages from /api/pages are flat with slug paths like "blog/post-1"
  // Build a tree by nesting based on slug depth
  const roots: TreeNode[] = []
  const map = new Map<string, TreeNode>()

  for (const page of pages) {
    map.set(page.slug, { ...page, children: [] })
  }

  for (const [slug, node] of map) {
    const parts = slug.split('/')
    if (parts.length === 1) {
      roots.push(node)
    } else {
      const parentSlug = parts.slice(0, -1).join('/')
      const parent = map.get(parentSlug)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node) // orphan — treat as root
      }
    }
  }

  return roots
}

export function usePageTree() {
  const tree = ref<TreeNode[]>([])
  const loading = ref(false)
  const api = useApi()

  async function load(): Promise<void> {
    loading.value = true
    try {
      const pages = await api.get<PageObject[]>('/api/pages')
      tree.value = buildTree(pages)
    } finally {
      loading.value = false
    }
  }

  async function moveItem(fromSlug: string, toSlug: string, position: 'before' | 'after' | 'child'): Promise<void> {
    await api.put('/api/pages/reorder', { fromSlug, toSlug, position })
    await load()
  }

  async function deleteItem(slug: string): Promise<void> {
    await api.del(`/api/pages/${slug}`)
    await load()
  }

  async function createItem(parentSlug: string, title: string): Promise<PageObject> {
    const slug = (parentSlug ? `${parentSlug}/` : '') + title.toLowerCase().replace(/\s+/g, '-')
    const page = await api.post<PageObject>('/api/pages', { slug, title, template: 'default' })
    await load()
    return page
  }

  return { tree, loading, load, moveItem, deleteItem, createItem }
}
