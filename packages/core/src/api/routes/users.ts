import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { UserStore } from '../../users/UserStore.js'
import { AuthService } from '../../users/AuthService.js'
import type { PermissionSystem } from '../../users/PermissionSystem.js'
import type { User, UserRole } from '../../users/types.js'
import { AuthError } from '../../users/errors.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

type SafeUser = Omit<User, 'passwordHash'>

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _ph, ...safe } = user
  return safe
}

interface RouteOptions {
  authService: AuthService
  userStore: UserStore
  permissionSystem: PermissionSystem
  authPreHandler: preHandlerHookHandler
  siteServiceCache?: SiteServiceCache
  jwtSecret?: string
}

export async function registerUserRoutes(
  app: FastifyInstance,
  { authService, userStore, permissionSystem, authPreHandler, siteServiceCache, jwtSecret }: RouteOptions,
): Promise<void> {
  function resolveServices(request: FastifyRequest): { store: UserStore; auth: AuthService } {
    if (request.siteContext && siteServiceCache && jwtSecret) {
      const store = siteServiceCache.getUserStore(request.siteContext)
      return { store, auth: new AuthService(store, jwtSecret) }
    }
    return { store: userStore, auth: authService }
  }

  // POST /api/auth/login — rate-limited to 5/min per IP (disabled in test env)
  const loginRateLimit = process.env['BLDMRK_FAST_HASH'] === '1'
    ? {}
    : { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }
  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    {
      ...loginRateLimit,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { auth } = resolveServices(request)
      try {
        return await auth.login(request.body.email, request.body.password)
      } catch (err) {
        if (err instanceof AuthError) {
          reply.code(401).send({ error: 'Invalid credentials' })
          return
        }
        throw err
      }
    },
  )

  // POST /api/auth/refresh
  app.post<{ Body: { refreshToken: string } }>(
    '/api/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { auth } = resolveServices(request)
      try {
        return await auth.refreshToken(request.body.refreshToken)
      } catch {
        reply.code(401).send({ error: 'Invalid or expired refresh token' })
      }
    },
  )

  // GET /api/users — admin only
  app.get(
    '/api/users',
    { preHandler: authPreHandler },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'admin')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      const { store } = resolveServices(request)
      return (await store.list()).map(toSafeUser)
    },
  )

  // POST /api/users — admin only
  app.post<{ Body: { email: string; password: string; role: UserRole } }>(
    '/api/users',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'role'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'admin')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      const { store } = resolveServices(request)
      const user = await store.create(request.body)
      reply.code(201).send(toSafeUser(user))
    },
  )

  // PUT /api/users/:id — admin only
  app.put<{ Params: { id: string }; Body: Partial<Pick<User, 'email' | 'role'>> & { password?: string } }>(
    '/api/users/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'admin')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      const { store } = resolveServices(request)
      try {
        return toSafeUser(await store.update(request.params.id, request.body))
      } catch (err) {
        if (err instanceof Error && err.message.includes('not found')) {
          reply.code(404).send({ error: 'User not found' })
        } else {
          reply.code(400).send({ error: err instanceof Error ? err.message : 'Update failed' })
        }
      }
    },
  )

  // DELETE /api/users/:id — admin only
  app.delete<{ Params: { id: string } }>(
    '/api/users/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'admin')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      const { store } = resolveServices(request)
      try {
        await store.delete(request.params.id)
        reply.code(204).send()
      } catch {
        reply.code(404).send({ error: 'User not found' })
      }
    },
  )
}
