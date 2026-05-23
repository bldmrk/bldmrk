import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { CacheStore } from '../../cache/CacheStore.js'
import { CacheStats } from '../../cache/CacheStats.js'

// Async pre-handler compatible type (Fastify 5 accepts async handlers in route options)
export type CachePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export interface CachePluginOptions {
  store: CacheStore
  stats?: CacheStats
}

export interface CacheDecorator {
  store: CacheStore
  stats: CacheStats
}

declare module 'fastify' {
  interface FastifyInstance {
    cache: CacheDecorator
  }
}

const cachePlugin: FastifyPluginAsync<CachePluginOptions> = async (
  app: FastifyInstance,
  options: CachePluginOptions,
) => {
  // Reuse stats instance passed in options if available, otherwise create one
  const stats = options.stats ?? new CacheStats()
  app.decorate('cache', {
    store: options.store,
    stats,
  })
}

export const registerCachePlugin = fp(cachePlugin, {
  name: 'bldmrk-cache',
})

interface CachedEntry {
  status: number
  payload: unknown
  headers: Record<string, string>
}

/**
 * Returns a Fastify preHandler that serves GET responses from cache.
 * Cache-Key: `${METHOD}:${url}` (includes query params).
 * On HIT: sets X-Cache: HIT and sends cached response, aborting the handler.
 * On MISS: sets X-Cache: MISS and marks the request for capture via onSend.
 */
export function makeCacheHandler(store: CacheStore, stats: CacheStats, ttlSeconds: number): CachePreHandler {
  return async function cachePreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.method !== 'GET') return

    const key = `${request.method}:${request.url}`
    const cached = await store.get<CachedEntry>(key)

    if (cached !== null) {
      stats.recordHit()
      for (const [name, value] of Object.entries(cached.headers)) {
        reply.header(name, value)
      }
      reply.header('X-Cache', 'HIT')
      // Calling reply.send() in a preHandler short-circuits the route handler in Fastify 5
      await reply.code(cached.status).send(cached.payload)
      return
    }

    stats.recordMiss()
    reply.header('X-Cache', 'MISS')

    // Tag request for the onSend hook to store the response
    const req = request as FastifyRequest & { _cacheKey: string; _cacheTtl: number }
    req._cacheKey = key
    req._cacheTtl = ttlSeconds
  }
}

/**
 * Registers the global onSend hook that captures and stores cacheable responses.
 * Only stores when the request was tagged by makeCacheHandler (i.e. it was a MISS).
 */
export function registerCacheSendHook(app: FastifyInstance, store: CacheStore): void {
  app.addHook('onSend', async (request, reply, payload) => {
    const req = request as FastifyRequest & { _cacheKey?: string; _cacheTtl?: number }
    if (!req._cacheKey || request.method !== 'GET') return payload

    const status = reply.statusCode
    // Only cache successful responses
    if (status < 200 || status >= 300) return payload

    const headers: Record<string, string> = {}
    const contentType = reply.getHeader('content-type')
    if (contentType) {
      headers['content-type'] = String(contentType)
    }

    let parsedPayload: unknown
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload)
      } catch {
        parsedPayload = payload
      }
    } else {
      parsedPayload = payload
    }

    await store.set<CachedEntry>(
      req._cacheKey,
      { status, payload: parsedPayload, headers },
      req._cacheTtl,
    ).catch(() => {
      // Never let cache write failures affect the response
    })

    return payload
  })
}
