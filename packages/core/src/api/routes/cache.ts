import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { CacheStore } from '../../cache/CacheStore.js'
import type { CacheStats } from '../../cache/CacheStats.js'
import { MemoryCache } from '../../cache/MemoryCache.js'

interface RouteOptions {
  cacheStore: CacheStore
  cacheStats: CacheStats
  authPreHandler: preHandlerHookHandler
}

export async function registerCacheRoutes(
  app: FastifyInstance,
  { cacheStore, cacheStats, authPreHandler }: RouteOptions,
): Promise<void> {
  // GET /api/cache/stats — admin only
  app.get(
    '/api/cache/stats',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!request.user || request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      // MemoryCache exposes a size getter; other providers report 0
      const size = cacheStore instanceof MemoryCache ? cacheStore.size : 0

      return reply.send({
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size,
        hitRate: cacheStats.hitRate,
      })
    },
  )

  // POST /api/cache/clear — admin only
  app.post(
    '/api/cache/clear',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!request.user || request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      await cacheStore.clear()
      cacheStats.reset()
      return reply.send({ cleared: true })
    },
  )
}
