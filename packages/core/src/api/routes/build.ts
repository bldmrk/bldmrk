import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { BuildQueue } from '../../build/BuildQueue.js'

interface BuildRouteOptions {
  buildQueue: BuildQueue
  authPreHandler: preHandlerHookHandler
}

export async function registerBuildRoutes(
  app: FastifyInstance,
  { buildQueue, authPreHandler }: BuildRouteOptions,
): Promise<void> {
  // POST /api/build — enqueue a build immediately, respond 202
  app.post('/api/build', { preHandler: authPreHandler }, async (_req, reply) => {
    buildQueue.enqueue()
    return reply.code(202).send({ queued: true })
  })

  // GET /api/build/status — SSE stream of status updates
  app.get('/api/build/status', { preHandler: authPreHandler }, async (_req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    // Subscribe first to avoid missing events in the race window
    const unsub = buildQueue.onStatusChange((update) => {
      reply.raw.write(`data: ${JSON.stringify(update)}\n\n`)
    })

    // Then send current status snapshot
    reply.raw.write(`data: ${JSON.stringify({ status: buildQueue.getStatus() })}\n\n`)

    // Keep the connection open until client disconnects
    await new Promise<void>((resolve) => {
      reply.raw.on('close', () => {
        unsub()
        resolve()
      })
    })
  })

  // GET /api/build/history — last 10 build results
  app.get('/api/build/history', { preHandler: authPreHandler }, async (_req, reply) => {
    return reply.send(buildQueue.getHistory())
  })
}
