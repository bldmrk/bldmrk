import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { ConfigLoader } from '../../config/ConfigLoader.js'
import type { CacheStore } from '../../cache/CacheStore.js'
import type { CachePreHandler } from '../middleware/cache.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface ConfigRouteOptions {
  configDir: string
  authPreHandler: preHandlerHookHandler
  siteConfigCachePreHandler?: CachePreHandler
  cacheStore?: CacheStore
  siteServiceCache?: SiteServiceCache
}

export async function registerConfigRoutes(
  app: FastifyInstance,
  { configDir, authPreHandler, siteConfigCachePreHandler, cacheStore }: ConfigRouteOptions,
): Promise<void> {
  const loader = new ConfigLoader()

  app.get(
    '/api/config/site',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preHandler: (siteConfigCachePreHandler ? [authPreHandler, siteConfigCachePreHandler] : authPreHandler) as any,
    },
    async (_req, reply) => {
      const { site } = await loader.load(configDir)
      return reply.send(site)
    },
  )

  app.put('/api/config/site', { preHandler: authPreHandler }, async (req, reply) => {
    const saved = await loader.saveSite(configDir, req.body)
    await cacheStore?.deleteByPrefix('GET:/api/config/site')
    return reply.send(saved)
  })

  app.get('/api/config/system', { preHandler: authPreHandler }, async (_req, reply) => {
    const { system } = await loader.load(configDir)
    return reply.send(system)
  })

  app.put('/api/config/system', { preHandler: authPreHandler }, async (req, reply) => {
    const saved = await loader.saveSystem(configDir, req.body)
    return reply.send(saved)
  })
}
