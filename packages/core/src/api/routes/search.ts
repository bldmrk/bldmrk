import type { FastifyInstance } from 'fastify'
import type { SearchIndex, SearchResult } from '../../search/SearchIndex.js'
import type { CachePreHandler } from '../middleware/cache.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface RouteOptions {
  searchIndex: SearchIndex
  cachePreHandler?: CachePreHandler
  siteServiceCache?: SiteServiceCache
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  { searchIndex, cachePreHandler, siteServiceCache }: RouteOptions,
): Promise<void> {
  // GET /api/search?q=<query>&limit=<number>
  app.get<{
    Querystring: { q?: string; limit?: string }
  }>(
    '/api/search',
    {
      preHandler: cachePreHandler,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'string' },
          },
        },
      },
    },
    async (request): Promise<SearchResult[]> => {
      const q = request.query.q?.trim() ?? ''
      if (!q) return []

      const limitParam = request.query.limit
      const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10)) : 10

      const index = request.siteContext && siteServiceCache
        ? await siteServiceCache.getSearchIndex(request.siteContext)
        : searchIndex

      return index.search(q, limit)
    },
  )
}
