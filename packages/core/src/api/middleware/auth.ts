import type { FastifyRequest, FastifyReply } from 'fastify'
import type { AuthService } from '../../users/AuthService.js'
import { TokenExpiredError, TokenTypeError } from '../../users/errors.js'

export function buildAuthMiddleware(authService: AuthService) {
  return async function authPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers.authorization
    const queryToken = (request.query as Record<string, string>).token
    if (!authHeader?.startsWith('Bearer ') && !queryToken) {
      reply.code(401).send({ error: 'Unauthorized' })
      return
    }
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken!
    try {
      request.user = await authService.verifyToken(token)
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        reply.code(401).send({ error: 'Token expired' })
      } else if (err instanceof TokenTypeError) {
        reply.code(401).send({ error: 'Wrong token type' })
      } else {
        reply.code(401).send({ error: 'Unauthorized' })
      }
      return
    }
  }
}
