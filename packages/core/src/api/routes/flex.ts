import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { FlexLoader } from '../../flex/FlexLoader.js'
import { FlexValidationException } from '../../flex/FlexLoader.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface RouteOptions {
  flexLoader: FlexLoader
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  siteServiceCache?: SiteServiceCache
}

export async function registerFlexRoutes(
  app: FastifyInstance,
  { flexLoader, authPreHandler }: RouteOptions,
): Promise<void> {
  // GET /api/flex — list all defined types (admin only)
  app.get('/api/flex', { preHandler: authPreHandler }, async () => {
    return flexLoader.loadTypes()
  })

  // GET /api/flex/:type — all entries (public if schema.public === true, else admin only)
  app.get<{ Params: { type: string } }>(
    '/api/flex/:type',
    {
      schema: {
        params: { type: 'object', properties: { type: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { type } = request.params

      let flexType
      try {
        flexType = await flexLoader.loadType(type)
      } catch {
        return reply.code(404).send({ error: `Flex type not found: ${type}` })
      }

      if (!flexType.public) {
        await authPreHandler(request, reply)
        if (reply.sent) return
      }

      return flexLoader.loadEntries(type)
    },
  )

  // GET /api/flex/:type/:id — single entry (same public/auth logic)
  app.get<{ Params: { type: string; id: string } }>(
    '/api/flex/:type/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { type, id } = request.params

      let flexType
      try {
        flexType = await flexLoader.loadType(type)
      } catch {
        return reply.code(404).send({ error: `Flex type not found: ${type}` })
      }

      if (!flexType.public) {
        await authPreHandler(request, reply)
        if (reply.sent) return
      }

      try {
        return await flexLoader.loadEntry(type, id)
      } catch {
        return reply.code(404).send({ error: `Flex entry not found: ${type}/${id}` })
      }
    },
  )

  // POST /api/flex/:type — create entry (admin only)
  app.post<{ Params: { type: string }; Body: Record<string, unknown> }>(
    '/api/flex/:type',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { type: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { type } = request.params
      const data = request.body ?? {}

      try {
        await flexLoader.loadType(type)
      } catch {
        return reply.code(404).send({ error: `Flex type not found: ${type}` })
      }

      try {
        const id = await flexLoader.createEntry(type, data)
        const entry = await flexLoader.loadEntry(type, id)
        return reply.code(201).send(entry)
      } catch (err) {
        if (err instanceof FlexValidationException) {
          return reply.code(422).send({ errors: err.errors })
        }
        throw err
      }
    },
  )

  // PUT /api/flex/:type/:id — update entry (admin only)
  app.put<{ Params: { type: string; id: string }; Body: Record<string, unknown> }>(
    '/api/flex/:type/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { type, id } = request.params
      const data = request.body ?? {}

      try {
        await flexLoader.loadType(type)
      } catch {
        return reply.code(404).send({ error: `Flex type not found: ${type}` })
      }

      // Verify entry exists
      try {
        await flexLoader.loadEntry(type, id)
      } catch {
        return reply.code(404).send({ error: `Flex entry not found: ${type}/${id}` })
      }

      try {
        await flexLoader.saveEntry(type, id, data)
        const entry = await flexLoader.loadEntry(type, id)
        return reply.code(200).send(entry)
      } catch (err) {
        if (err instanceof FlexValidationException) {
          return reply.code(422).send({ errors: err.errors })
        }
        throw err
      }
    },
  )

  // DELETE /api/flex/:type/:id — delete entry (admin only)
  app.delete<{ Params: { type: string; id: string } }>(
    '/api/flex/:type/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { type, id } = request.params

      try {
        await flexLoader.loadType(type)
      } catch {
        return reply.code(404).send({ error: `Flex type not found: ${type}` })
      }

      try {
        await flexLoader.deleteEntry(type, id)
        return reply.code(204).send()
      } catch {
        return reply.code(404).send({ error: `Flex entry not found: ${type}/${id}` })
      }
    },
  )
}
