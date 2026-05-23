import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { BlueprintEngine } from '../../blueprint/BlueprintEngine.js'

interface RouteOptions {
  blueprintEngine: BlueprintEngine
  authPreHandler: preHandlerHookHandler
}

export async function registerBlueprintRoutes(
  app: FastifyInstance,
  { blueprintEngine, authPreHandler }: RouteOptions,
): Promise<void> {
  app.get('/api/blueprints', { preHandler: authPreHandler }, async () => {
    const [pages, config] = await Promise.all([
      blueprintEngine.list('pages'),
      blueprintEngine.list('config'),
    ])
    return { pages, config }
  })

  app.get<{ Params: { name: string } }>(
    '/api/blueprints/pages/:name',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { name } = request.params
      try {
        return await blueprintEngine.resolve('pages', name)
      } catch {
        return reply.code(404).send({ error: `Blueprint not found: pages/${name}` })
      }
    },
  )

  app.get<{ Params: { name: string } }>(
    '/api/blueprints/config/:name',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { name } = request.params
      try {
        return await blueprintEngine.resolve('config', name)
      } catch {
        return reply.code(404).send({ error: `Blueprint not found: config/${name}` })
      }
    },
  )
}
