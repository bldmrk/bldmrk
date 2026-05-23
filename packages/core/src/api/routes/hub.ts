import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { SiteRegistry } from '../../multisite/SiteRegistry.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'
import type { BuildTrigger } from '../../build/BuildTrigger.js'

interface HubRouteOptions {
  registry: SiteRegistry
  siteServiceCache: SiteServiceCache
  buildTrigger: BuildTrigger
  authPreHandler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
}

function checkHubToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const hubToken = process.env.FOLIO_HUB_TOKEN
  if (!hubToken) {
    reply.code(503).send({ error: 'Hub not configured' })
    return false
  }
  const provided = request.headers['x-hub-token']
  if (provided !== hubToken) {
    reply.code(401).send({ error: 'Invalid hub token' })
    return false
  }
  return true
}

export async function registerHubRoutes(
  app: FastifyInstance,
  { registry, siteServiceCache, buildTrigger }: HubRouteOptions,
): Promise<void> {
  // GET /__hub/api/sites
  app.get('/__hub/api/sites', async (request, reply) => {
    if (!checkHubToken(request, reply)) return

    const sites = await Promise.all(registry.sites.map(async site => {
      let pageCount = 0
      let lastBackup: string | null = null
      try {
        const loader = siteServiceCache.getPageLoader(site)
        const pages = await loader.loadAll()
        pageCount = pages.length
      } catch {}
      try {
        const backup = siteServiceCache.getBackupService(site)
        const backups = await backup.listBackups()
        if (backups.length > 0) {
          lastBackup = backups[0].createdAt.toISOString()
        }
      } catch {}
      return {
        id: site.id,
        domain: site.domain,
        aliases: site.aliases,
        contentDir: site.contentDir,
        pageCount,
        lastBackup,
      }
    }))
    return reply.send(sites)
  })

  // POST /__hub/api/sites/:id/build
  app.post('/__hub/api/sites/:id/build', async (request, reply) => {
    if (!checkHubToken(request, reply)) return

    const { id } = request.params as { id: string }
    const site = registry.sites.find(s => s.id === id)
    if (!site) return reply.code(404).send({ error: 'Site not found' })

    const queue = siteServiceCache.getBuildQueue(site, buildTrigger)
    queue.enqueue()
    return reply.send({ status: 'queued', siteId: id, triggeredAt: new Date().toISOString() })
  })

  // POST /__hub/api/sites/:id/backup
  app.post('/__hub/api/sites/:id/backup', async (request, reply) => {
    if (!checkHubToken(request, reply)) return

    const { id } = request.params as { id: string }
    const site = registry.sites.find(s => s.id === id)
    if (!site) return reply.code(404).send({ error: 'Site not found' })

    const backup = siteServiceCache.getBackupService(site)
    const meta = await backup.createBackup('content')
    return reply.send({ siteId: id, backup: meta })
  })
}
