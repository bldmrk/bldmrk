import { mkdir, writeFile, rm, rename, readdir } from 'fs/promises'
import path from 'path'
import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { PageLoader } from '../../content/PageLoader.js'
import type { PermissionSystem } from '../../users/PermissionSystem.js'
import type { CacheStore } from '../../cache/CacheStore.js'
import type { CachePreHandler } from '../middleware/cache.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'
import type { GitService } from '../../git/GitService.js'
import { PageNotFoundError } from '../../content/errors.js'
import { dump as dumpYaml } from 'js-yaml'

const FOLDER_RE = /^(\d+)--(.+)$/
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

interface RouteOptions {
  pageLoader: PageLoader
  permissionSystem: PermissionSystem
  authPreHandler: preHandlerHookHandler
  pagesDir: string
  cachePreHandler?: CachePreHandler
  cacheStore?: CacheStore
  siteServiceCache?: SiteServiceCache
  gitService?: GitService
  autoCommit?: boolean
}

async function findPageFolder(pagesDir: string, slug: string): Promise<string | null> {
  const entries = await readdir(pagesDir).catch(() => [])
  return entries.find(e => FOLDER_RE.exec(e)?.[2] === slug) ?? null
}

async function getNextOrder(pagesDir: string): Promise<number> {
  const entries = await readdir(pagesDir).catch(() => [])
  const orders = entries
    .map(e => { const m = FOLDER_RE.exec(e); return m ? parseInt(m[1]!, 10) : null })
    .filter((n): n is number => n !== null)
  return orders.length === 0 ? 1 : Math.max(...orders) + 1
}

export async function registerPageRoutes(
  app: FastifyInstance,
  opts: RouteOptions,
): Promise<void> {
  const { pageLoader, permissionSystem, authPreHandler, pagesDir, cachePreHandler, cacheStore, siteServiceCache, gitService, autoCommit } = opts

  function resolveLoader(request: FastifyRequest): PageLoader {
    return request.siteContext && siteServiceCache
      ? siteServiceCache.getPageLoader(request.siteContext)
      : pageLoader
  }

  function resolvePagesDir(request: FastifyRequest): string {
    return request.siteContext && siteServiceCache
      ? path.join(request.siteContext.contentDir, 'pages')
      : pagesDir
  }

  // GET /api/pages
  app.get(
    '/api/pages',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preHandler: (cachePreHandler ? [authPreHandler, cachePreHandler] : authPreHandler) as any,
    },
    async (request) => {
      return resolveLoader(request).loadAll()
    },
  )

  // GET /api/pages/:slug
  app.get<{ Params: { slug: string } }>(
    '/api/pages/:slug',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preHandler: (cachePreHandler ? [authPreHandler, cachePreHandler] : authPreHandler) as any,
      schema: { params: { type: 'object', properties: { slug: { type: 'string' } } } },
    },
    async (request, reply) => {
      try {
        return await resolveLoader(request).load(request.params.slug)
      } catch (err) {
        if (err instanceof PageNotFoundError) {
          reply.code(404).send({ error: 'Page not found' })
          return
        }
        throw err
      }
    },
  )

  // POST /api/pages
  app.post<{ Body: { slug: string; content?: string; title?: string; template?: string; published?: boolean } }>(
    '/api/pages',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            content: { type: 'string' },
            title: { type: 'string' },
            template: { type: 'string' },
            published: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'write')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      const { slug, content = '', ...meta } = request.body
      if (!isValidSlug(slug)) {
        reply.code(400).send({ error: 'Invalid slug: must match [a-z0-9-]+' })
        return
      }
      const loader = resolveLoader(request)
      const dir = resolvePagesDir(request)
      const order = await getNextOrder(dir)
      const folderPath = path.join(dir, `${String(order).padStart(3, '0')}--${slug}`)
      await mkdir(folderPath, { recursive: true })
      await writeFile(path.join(folderPath, 'index.mdx'), content, 'utf-8')
      await writeFile(path.join(folderPath, 'page.yaml'), dumpYaml(meta), 'utf-8')
      await cacheStore?.deleteByPrefix('GET:/api/pages')
      const page = await loader.load(slug)
      reply.code(201).send(page)
    },
  )

  // PUT /api/pages/:slug
  app.put<{ Params: { slug: string }; Body: { content?: string; title?: string; template?: string; published?: boolean } }>(
    '/api/pages/:slug',
    {
      preHandler: authPreHandler,
      schema: {
        params: { type: 'object', properties: { slug: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            title: { type: 'string' },
            template: { type: 'string' },
            published: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'write')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      if (!isValidSlug(request.params.slug)) {
        reply.code(400).send({ error: 'Invalid slug' })
        return
      }
      const loader = resolveLoader(request)
      const dir = resolvePagesDir(request)
      const folderName = await findPageFolder(dir, request.params.slug)
      if (!folderName) { reply.code(404).send({ error: 'Page not found' }); return }
      const folderPath = path.join(dir, folderName)
      const { content, ...meta } = request.body
      if (content !== undefined) {
        await writeFile(path.join(folderPath, 'index.mdx'), content, 'utf-8')
      }
      if (Object.keys(meta).length > 0) {
        await writeFile(path.join(folderPath, 'page.yaml'), dumpYaml(meta), 'utf-8')
      }
      loader.invalidate(request.params.slug)
      await cacheStore?.deleteByPrefix('GET:/api/pages')
      if (autoCommit && gitService) {
        await gitService.commit(`Save: ${request.params.slug}`, [`content/pages/${folderName}`]).catch(() => undefined)
      }
      return loader.load(request.params.slug)
    },
  )

  // DELETE /api/pages/:slug
  app.delete<{ Params: { slug: string } }>(
    '/api/pages/:slug',
    {
      preHandler: authPreHandler,
      schema: { params: { type: 'object', properties: { slug: { type: 'string' } } } },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'write')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      if (!isValidSlug(request.params.slug)) {
        reply.code(400).send({ error: 'Invalid slug' })
        return
      }
      const loader = resolveLoader(request)
      const dir = resolvePagesDir(request)
      const folderName = await findPageFolder(dir, request.params.slug)
      if (!folderName) { reply.code(404).send({ error: 'Page not found' }); return }
      await rm(path.join(dir, folderName), { recursive: true })
      loader.invalidate(request.params.slug)
      await cacheStore?.deleteByPrefix('GET:/api/pages')
      reply.code(204).send()
    },
  )

  // PATCH /api/pages/reorder
  app.patch<{ Body: { items: { slug: string; order: number }[] } }>(
    '/api/pages/reorder',
    {
      preHandler: authPreHandler,
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['slug', 'order'],
                properties: {
                  slug: { type: 'string' },
                  order: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user || !permissionSystem.hasPermission(request.user, 'write')) {
        reply.code(403).send({ error: 'Forbidden' })
        return
      }
      if (request.body.items.some(item => !isValidSlug(item.slug))) {
        reply.code(400).send({ error: 'Invalid slug in items' })
        return
      }
      const loader = resolveLoader(request)
      const dir = resolvePagesDir(request)
      for (const item of request.body.items) {
        const folderName = await findPageFolder(dir, item.slug)
        if (!folderName) continue
        const newName = `${String(item.order).padStart(3, '0')}--${item.slug}`
        if (folderName !== newName) {
          await rename(path.join(dir, folderName), path.join(dir, newName))
          loader.invalidate(item.slug)
        }
      }
      reply.code(204).send()
    },
  )
}
