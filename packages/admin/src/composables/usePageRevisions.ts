import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useApi } from './useApi.js'
import type { Ref } from 'vue'

export interface PageRevision {
  hash: string
  message: string
  author: string
  date: string
}

export interface RevisionContent {
  hash: string
  slug: string
  content: string
}

export function usePageRevisions(slug: Ref<string>) {
  const api = useApi()

  const revisions = useQuery<PageRevision[]>({
    queryKey: ['page-revisions', slug],
    queryFn: () => api.get<PageRevision[]>(`/api/git/log?file=${encodeURIComponent(slug.value)}`),
    enabled: () => !!slug.value,
  })

  return { revisions }
}

export function useRevisionContent(hash: Ref<string | null>, slug: Ref<string>) {
  const api = useApi()

  const content = useQuery<RevisionContent>({
    queryKey: ['revision-content', hash, slug],
    queryFn: () => api.get<RevisionContent>(`/api/git/show/${hash.value}?file=${encodeURIComponent(slug.value)}`),
    enabled: () => !!hash.value && !!slug.value,
  })

  return { content }
}

export function useRestoreRevision(slug: Ref<string>) {
  const api = useApi()
  const queryClient = useQueryClient()

  const restore = useMutation({
    mutationFn: (hash: string) =>
      api.post<{ hash: string; slug: string }>('/api/git/restore', { hash, slug: slug.value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['page-revisions', slug] })
    },
  })

  return { restore }
}
