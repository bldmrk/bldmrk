import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import type { FormLoader } from '../../forms/FormLoader.js'
import type { FormSubmissionService } from '../../forms/FormSubmissionService.js'
import type { FormBlueprint } from '../../forms/FormSchema.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface RouteOptions {
  formLoader: FormLoader
  formSubmissionService: FormSubmissionService
  authPreHandler: preHandlerHookHandler
  projectDir: string
  siteServiceCache?: SiteServiceCache
}

/** Strip action details (e.g. email/webhook credentials) from public responses */
function publicBlueprint(blueprint: FormBlueprint): Omit<FormBlueprint, 'actions'> & { actions: { redirect?: string } } {
  return {
    name: blueprint.name,
    fields: blueprint.fields,
    honeypot: blueprint.honeypot,
    rateLimit: blueprint.rateLimit,
    actions: {
      redirect: blueprint.actions.redirect,
    },
  }
}

export async function registerFormRoutes(
  app: FastifyInstance,
  { formLoader, formSubmissionService, authPreHandler, projectDir }: RouteOptions,
): Promise<void> {
  // GET /api/forms — list all forms (public, strips action details)
  app.get('/api/forms', async () => {
    const blueprints = await formLoader.loadAll()
    return blueprints.map(publicBlueprint)
  })

  // GET /api/forms/:name — single blueprint (public)
  app.get<{ Params: { name: string } }>(
    '/api/forms/:name',
    {
      schema: {
        params: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      try {
        const blueprint = await formLoader.load(request.params.name)
        return publicBlueprint(blueprint)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Not found'
        return reply.code(404).send({ error: msg })
      }
    },
  )

  // POST /api/forms/:name/submit — process submission (public, rate-limited)
  app.post<{ Params: { name: string }; Body: Record<string, unknown> }>(
    '/api/forms/:name/submit',
    {
      schema: {
        params: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { name } = request.params
      const data = request.body ?? {}
      const clientIp = request.ip ?? '0.0.0.0'

      let result
      try {
        result = await formSubmissionService.submit(name, data, clientIp)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Server error'
        if (msg.includes('not found')) {
          return reply.code(404).send({ error: msg })
        }
        return reply.code(500).send({ error: msg })
      }

      if (result.rateLimited) {
        return reply.code(429).send({ error: 'Too many submissions. Please try again later.' })
      }

      if (!result.success && result.errors) {
        return reply.code(422).send({ errors: result.errors })
      }

      return reply.code(200).send({ success: true })
    },
  )

  // GET /api/forms/:name/submissions — stored submissions (admin only)
  app.get<{ Params: { name: string } }>(
    '/api/forms/:name/submissions',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { name } = request.params
      const blueprint = await formLoader.load(name).catch(() => null)
      if (!blueprint) {
        return reply.code(404).send({ error: `Form not found: ${name}` })
      }

      const savePath = blueprint.actions.save?.path ?? 'content/data/forms'
      const submissionDir = path.join(projectDir, savePath, name)

      let files: string[]
      try {
        files = await fs.readdir(submissionDir)
      } catch {
        return []
      }

      const submissions = []
      for (const file of files.filter(f => f.endsWith('.yaml'))) {
        const id = file.replace(/\.yaml$/, '')
        const filePath = path.join(submissionDir, file)
        try {
          const raw = await fs.readFile(filePath, 'utf-8')
          const data = yaml.load(raw)
          submissions.push({ id, data })
        } catch {
          // skip unreadable
        }
      }

      return submissions
    },
  )

  // DELETE /api/forms/:name/submissions/:id — delete submission (admin only)
  app.delete<{ Params: { name: string; id: string } }>(
    '/api/forms/:name/submissions/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: {
          type: 'object',
          properties: { name: { type: 'string' }, id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { name, id } = request.params

      // Basic security: ensure id has no path traversal
      if (id.includes('/') || id.includes('..') || id.includes('\\')) {
        return reply.code(400).send({ error: 'Invalid submission id' })
      }

      const blueprint = await formLoader.load(name).catch(() => null)
      if (!blueprint) {
        return reply.code(404).send({ error: `Form not found: ${name}` })
      }

      const savePath = blueprint.actions.save?.path ?? 'content/data/forms'
      const filePath = path.join(projectDir, savePath, name, `${id}.yaml`)

      try {
        await fs.unlink(filePath)
      } catch {
        return reply.code(404).send({ error: 'Submission not found' })
      }

      return reply.code(204).send()
    },
  )
}
