import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { Scheduler } from '../../scheduler/Scheduler.js'

interface RouteOptions {
  scheduler: Scheduler
  authPreHandler: preHandlerHookHandler
}

export async function registerSchedulerRoutes(
  app: FastifyInstance,
  { scheduler, authPreHandler }: RouteOptions,
): Promise<void> {
  // GET /api/scheduler — list all jobs with last status
  app.get(
    '/api/scheduler',
    { preHandler: authPreHandler },
    async () => {
      return scheduler.getAll()
    },
  )

  // GET /api/scheduler/:id/history — job run history
  app.get<{ Params: { id: string } }>(
    '/api/scheduler/:id/history',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const history = scheduler.getHistory(request.params.id)
      // getHistory returns [] for unknown ids; we need to differentiate unknown vs empty
      const all = scheduler.getAll()
      const exists = all.some(j => j.id === request.params.id)
      if (!exists && history.length === 0) {
        reply.code(404).send({ error: 'Job not found' })
        return
      }
      return history
    },
  )

  // POST /api/scheduler/:id/run — manual trigger
  app.post<{ Params: { id: string } }>(
    '/api/scheduler/:id/run',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const all = scheduler.getAll()
      const job = all.find(j => j.id === request.params.id)
      if (!job) {
        reply.code(404).send({ error: 'Job not found' })
        return
      }
      // Run the handler via the scheduler's runNow method
      await scheduler.runNow(request.params.id)
      return { triggered: true, jobId: request.params.id }
    },
  )
}
