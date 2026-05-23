import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { createReadStream } from 'fs'
import { access } from 'fs/promises'
import type { BackupService } from '../../backup/BackupService.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface RouteOptions {
  backupService: BackupService
  authPreHandler: preHandlerHookHandler
  siteServiceCache?: SiteServiceCache
}

export async function registerBackupRoutes(
  app: FastifyInstance,
  { backupService, authPreHandler, siteServiceCache }: RouteOptions,
): Promise<void> {
  function resolveBackupService(request: FastifyRequest): BackupService {
    return request.siteContext && siteServiceCache
      ? siteServiceCache.getBackupService(request.siteContext)
      : backupService
  }

  // GET /api/backup — list all backups
  app.get(
    '/api/backup',
    { preHandler: authPreHandler },
    async (request) => {
      return resolveBackupService(request).listBackups()
    },
  )

  // POST /api/backup — create a new backup
  app.post<{ Body: { type?: 'content' | 'full' } }>(
    '/api/backup',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['content', 'full'] },
          },
        },
      },
    },
    async (request, reply) => {
      const type = request.body?.type ?? 'content'
      const meta = await backupService.createBackup(type)
      return reply.code(200).send(meta)
    },
  )

  // GET /api/backup/:id/download — stream ZIP file
  app.get<{ Params: { id: string } }>(
    '/api/backup/:id/download',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const zipPath = backupService.getBackupPath(id)

      try {
        await access(zipPath)
      } catch {
        return reply.code(404).send({ error: 'Backup not found' })
      }

      const stream = createReadStream(zipPath)
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${id}.zip"`)
        .send(stream)
    },
  )

  // DELETE /api/backup/:id — delete a backup
  app.delete<{ Params: { id: string } }>(
    '/api/backup/:id',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const zipPath = backupService.getBackupPath(id)

      try {
        await access(zipPath)
      } catch {
        return reply.code(404).send({ error: 'Backup not found' })
      }

      await backupService.deleteBackup(id)
      return reply.code(204).send()
    },
  )

  // POST /api/backup/:id/restore — restore a backup
  app.post<{ Params: { id: string } }>(
    '/api/backup/:id/restore',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const zipPath = backupService.getBackupPath(id)

      try {
        await access(zipPath)
      } catch {
        return reply.code(404).send({ error: 'Backup not found' })
      }

      // Restore runs asynchronously; respond immediately
      void backupService.restoreBackup(id)
      return reply.code(202).header('Location', `/api/backup/${id}/restore/status`).send({ backupId: id, status: 'pending' })
    },
  )

  // GET /api/backup/:id/restore/status — check restore status
  app.get<{ Params: { id: string } }>(
    '/api/backup/:id/restore/status',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const state = backupService.getRestoreState(request.params.id)
      if (!state) return reply.code(404).send({ error: 'No restore operation found' })
      return reply.send(state)
    },
  )
}
