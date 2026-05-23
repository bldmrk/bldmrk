import type { FastifyInstance } from 'fastify'
import type { TaxonomyIndex } from '../../taxonomy/TaxonomyIndex.js'
import type { CachePreHandler } from '../middleware/cache.js'
import type { SiteServiceCache } from '../../multisite/SiteServiceCache.js'

interface RouteOptions {
  taxonomyIndex: TaxonomyIndex
  cachePreHandler?: CachePreHandler
  siteServiceCache?: SiteServiceCache
}

export async function registerTaxonomyRoutes(
  app: FastifyInstance,
  { taxonomyIndex, cachePreHandler, siteServiceCache }: RouteOptions,
): Promise<void> {
  // GET /api/taxonomy/tags
  app.get('/api/taxonomy/tags', { preHandler: cachePreHandler }, async (request) => {
    const index = request.siteContext && siteServiceCache
      ? await siteServiceCache.getTaxonomyIndex(request.siteContext)
      : taxonomyIndex
    return index.getTags()
  })

  // GET /api/taxonomy/tags/:tag
  app.get<{ Params: { tag: string } }>(
    '/api/taxonomy/tags/:tag',
    {
      schema: {
        params: { type: 'object', properties: { tag: { type: 'string' } }, required: ['tag'] },
      },
    },
    async (request, reply) => {
      const index = request.siteContext && siteServiceCache
        ? await siteServiceCache.getTaxonomyIndex(request.siteContext)
        : taxonomyIndex
      const { tag } = request.params
      const tags = index.getTags()
      const entry = tags.find(t => t.value === tag || t.slug === tag)
      if (!entry) {
        return reply.status(404).send({ message: `Tag not found: ${tag}` })
      }
      const pages = index.getPagesByTag(entry.value)
      return { entry, pages }
    },
  )

  // GET /api/taxonomy/authors
  app.get('/api/taxonomy/authors', async (request) => {
    const index = request.siteContext && siteServiceCache
      ? await siteServiceCache.getTaxonomyIndex(request.siteContext)
      : taxonomyIndex
    return index.getAuthors()
  })

  // GET /api/taxonomy/authors/:author
  app.get<{ Params: { author: string } }>(
    '/api/taxonomy/authors/:author',
    {
      schema: {
        params: { type: 'object', properties: { author: { type: 'string' } }, required: ['author'] },
      },
    },
    async (request, reply) => {
      const index = request.siteContext && siteServiceCache
        ? await siteServiceCache.getTaxonomyIndex(request.siteContext)
        : taxonomyIndex
      const { author } = request.params
      const authors = index.getAuthors()
      const entry = authors.find(a => a.value === author || a.slug === author)
      if (!entry) {
        return reply.status(404).send({ message: `Author not found: ${author}` })
      }
      const pages = index.getPagesByAuthor(entry.value)
      return { entry, pages }
    },
  )
}
