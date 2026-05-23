import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { SiteRegistry } from '../../multisite/SiteRegistry.js'

export function buildSiteContextMiddleware(registry: SiteRegistry): preHandlerHookHandler {
  return async function siteContextHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Hub admin routes don't belong to a specific site
    if (request.url.startsWith('/__hub/')) return

    const host =
      (request.headers['x-forwarded-host'] as string | undefined) ??
      request.hostname

    const ctx = registry.resolve(host)
    if (!ctx) {
      reply.code(404).send({ error: 'Site not configured' })
      return
    }

    request.siteContext = ctx
  }
}
