import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { PluginRegistry } from '../../plugins/PluginRegistry.js'
import type { PluginLoader } from '../../plugins/PluginLoader.js'

interface PluginRouteOptions {
  authPreHandler: preHandlerHookHandler
  registry: PluginRegistry
  loader: PluginLoader
}

interface NpmSearchResult {
  objects: Array<{ package: { name: string; version: string; description: string } }>
}

export async function registerPluginRoutes(
  app: FastifyInstance,
  { authPreHandler, registry, loader }: PluginRouteOptions,
): Promise<void> {
  app.get('/api/plugins', { preHandler: authPreHandler }, async (_req, reply) => {
    return reply.send(registry.list())
  })

  app.get<{ Querystring: { q?: string } }>(
    '/api/plugins/search',
    { preHandler: authPreHandler },
    async (req, reply) => {
      const q = req.query.q?.trim() ?? ''
      const url = `https://registry.npmjs.org/-/v1/search?text=bldmrk-plugin+${encodeURIComponent(q)}&size=20`
      try {
        const res = await fetch(url)
        const data = await res.json() as NpmSearchResult
        const results = data.objects.map(o => ({
          name: o.package.name,
          version: o.package.version,
          description: o.package.description,
          installed: registry.isEnabled(o.package.name),
        }))
        return reply.send(results)
      } catch {
        return reply.send([])
      }
    },
  )

  app.post<{ Body: { name: string } }>(
    '/api/plugins/install',
    { preHandler: authPreHandler },
    async (req, reply) => {
      const { name } = req.body
      if (!name || typeof name !== 'string') {
        return reply.code(400).send({ message: 'name is required' })
      }
      await loader.addPlugin(name)
      return reply.send({ message: `Added "${name}" to plugins.yaml. Restart the server to activate.` })
    },
  )

  app.delete<{ Params: { name: string } }>(
    '/api/plugins/:name',
    { preHandler: authPreHandler },
    async (req, reply) => {
      await loader.removePlugin(req.params.name)
      return reply.send({ message: `Removed "${req.params.name}" from plugins.yaml.` })
    },
  )
}
