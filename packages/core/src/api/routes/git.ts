import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { GitService } from '../../git/GitService.js'

interface RouteOptions {
  gitService: GitService
  authPreHandler: preHandlerHookHandler
}

export async function registerGitRoutes(
  app: FastifyInstance,
  { gitService, authPreHandler }: RouteOptions,
): Promise<void> {
  // GET /api/git/log?limit=20&file=<slug>
  app.get<{ Querystring: { limit?: string; file?: string } }>(
    '/api/git/log',
    { preHandler: authPreHandler },
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20
      if (request.query.file) {
        return gitService.fileLog(request.query.file, limit)
      }
      return gitService.log(limit)
    },
  )

  // GET /api/git/show/:hash?file=<slug>
  app.get<{ Params: { hash: string }; Querystring: { file: string } }>(
    '/api/git/show/:hash',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { hash: { type: 'string' } } },
        querystring: {
          type: 'object',
          required: ['file'],
          properties: { file: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      try {
        const content = await gitService.showFile(request.params.hash, request.query.file)
        return { hash: request.params.hash, slug: request.query.file, content }
      } catch {
        return reply.code(404).send({ error: `Revision not found: ${request.params.hash}` })
      }
    },
  )

  // POST /api/git/restore
  app.post<{ Body: { hash: string; slug: string } }>(
    '/api/git/restore',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['hash', 'slug'],
          properties: {
            hash: { type: 'string' },
            slug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const newHash = await gitService.restoreFile(request.body.hash, request.body.slug)
        return { hash: newHash, slug: request.body.slug }
      } catch (err) {
        return reply.code(404).send({ error: err instanceof Error ? err.message : 'Restore failed' })
      }
    },
  )

  // GET /api/git/status
  app.get(
    '/api/git/status',
    { preHandler: authPreHandler },
    async () => {
      return gitService.status()
    },
  )

  // POST /api/git/commit — commits all content/ changes
  app.post<{ Body: { message: string } }>(
    '/api/git/commit',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { message } = request.body
      const hash = await gitService.commit(message, ['content/'])
      reply.code(201).send({ hash, message })
    },
  )

  // GET /api/git/diff/:slug
  app.get<{ Params: { slug: string } }>(
    '/api/git/diff/:slug',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { slug: { type: 'string' } } },
      },
    },
    async (request) => {
      const diff = await gitService.diff(request.params.slug)
      return { slug: request.params.slug, diff }
    },
  )
}
