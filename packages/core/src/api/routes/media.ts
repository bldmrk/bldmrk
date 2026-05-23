import { mkdir, writeFile, readdir, rm } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { MediaProcessor } from '../../content/MediaProcessor.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

const SAFE_SEGMENT_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

interface RouteOptions {
  contentDir: string
  authPreHandler: preHandlerHookHandler
  siteServiceCache?: SiteServiceCache
}

interface MediaObject {
  id: string
  filename: string
  url: string
  webpUrl: string
  width: number
  height: number
  size: number
  dir: string
}

async function collectMedia(dir: string, baseUrl: string): Promise<MediaObject[]> {
  const metaFile = path.join(dir, '.media-meta.json')
  try {
    const { readFile } = await import('fs/promises')
    const raw = await readFile(metaFile, 'utf-8')
    return JSON.parse(raw) as MediaObject[]
  } catch {
    return []
  }
}

async function saveMedia(dir: string, objects: MediaObject[]): Promise<void> {
  const { writeFile } = await import('fs/promises')
  await writeFile(path.join(dir, '.media-meta.json'), JSON.stringify(objects, null, 2))
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  { contentDir, authPreHandler, siteServiceCache }: RouteOptions,
): Promise<void> {
  function resolveContentDir(request: FastifyRequest): string {
    return request.siteContext && siteServiceCache
      ? request.siteContext.contentDir
      : contentDir
  }

  const globalMediaDir = path.join(contentDir, 'media')

  const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml',
  ])

  app.post('/api/media', { preHandler: authPreHandler }, async (request, reply) => {
    const reqContentDir = resolveContentDir(request)
    let fileBuffer: Buffer | undefined
    let filename = 'upload'
    let pageId: string | undefined

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (!ALLOWED_MIME.has(part.mimetype)) {
          await part.file.resume()
          return reply.code(415).send({ error: `Unsupported media type: ${part.mimetype}` })
        }
        const chunks: Buffer[] = []
        for await (const chunk of part.file) {
          chunks.push(chunk)
        }
        fileBuffer = Buffer.concat(chunks)
        filename = part.filename
      } else if (part.type === 'field' && part.fieldname === 'pageId') {
        pageId = part.value as string
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    if (pageId && !SAFE_SEGMENT_RE.test(pageId)) {
      return reply.code(400).send({ error: 'Invalid pageId' })
    }

    const reqGlobalMediaDir = path.join(reqContentDir, 'media')
    const targetDir = pageId
      ? path.join(reqContentDir, 'pages', pageId, 'media')
      : reqGlobalMediaDir
    await mkdir(targetDir, { recursive: true })

    const id = randomUUID()
    const ext = path.extname(filename) || '.jpg'
    const basename = `${id}${ext}`
    const webpBasename = `${id}.webp`

    const processed = await MediaProcessor.processUpload(fileBuffer, filename)

    await Promise.all([
      writeFile(path.join(targetDir, basename), processed.original),
      writeFile(path.join(targetDir, webpBasename), processed.webp),
    ])

    const urlBase = pageId ? `/media/pages/${pageId}` : '/media'
    const mediaObj: MediaObject = {
      id,
      filename: basename,
      url: `${urlBase}/${basename}`,
      webpUrl: `${urlBase}/${webpBasename}`,
      width: processed.width,
      height: processed.height,
      size: processed.size,
      dir: targetDir,
    }

    const existing = await collectMedia(targetDir, urlBase)
    await saveMedia(targetDir, [...existing, mediaObj])

    return reply.code(201).send(mediaObj)
  })

  app.get('/api/media', { preHandler: authPreHandler }, async (request, reply) => {
    const reqContentDir = resolveContentDir(request)
    const reqGlobalMediaDir = path.join(reqContentDir, 'media')
    const pageId = (request.query as Record<string, string>).pageId
    if (pageId) {
      if (!SAFE_SEGMENT_RE.test(pageId)) {
        return reply.code(400).send({ error: 'Invalid pageId' })
      }
      const dir = path.join(reqContentDir, 'pages', pageId, 'media')
      const objects = await collectMedia(dir, `/media/pages/${pageId}`)
      return objects
    }

    const globalObjects = await collectMedia(reqGlobalMediaDir, '/media')
    const pagesDir = path.join(reqContentDir, 'pages')
    let pageObjects: MediaObject[] = []
    try {
      const pageFolders = await readdir(pagesDir)
      const nested = await Promise.all(
        pageFolders.map(async (folder) => {
          const dir = path.join(pagesDir, folder, 'media')
          return collectMedia(dir, `/media/pages/${folder}`)
        }),
      )
      pageObjects = nested.flat()
    } catch {
      // no pages dir
    }

    return [...globalObjects, ...pageObjects]
  })

  app.delete<{ Params: { id: string } }>(
    '/api/media/:id',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const reqContentDir = resolveContentDir(request)
      const reqGlobalMediaDir = path.join(reqContentDir, 'media')
      const { id } = request.params

      async function deleteFromDir(dir: string): Promise<boolean> {
        const objects = await collectMedia(dir, '')
        const target = objects.find((o) => o.id === id)
        if (!target) return false

        const files = await readdir(dir).catch(() => [] as string[])
        await Promise.all(
          files
            .filter((f) => f.startsWith(id) && !f.startsWith('.'))
            .map((f) => rm(path.join(dir, f)).catch(() => undefined)),
        )
        await saveMedia(dir, objects.filter((o) => o.id !== id))
        return true
      }

      if (await deleteFromDir(reqGlobalMediaDir)) {
        return reply.code(204).send()
      }

      const pagesDir = path.join(reqContentDir, 'pages')
      try {
        const pageFolders = await readdir(pagesDir)
        for (const folder of pageFolders) {
          const dir = path.join(pagesDir, folder, 'media')
          if (await deleteFromDir(dir)) {
            return reply.code(204).send()
          }
        }
      } catch {
        // no pages dir
      }

      return reply.code(404).send({ error: 'Media not found' })
    },
  )
}
