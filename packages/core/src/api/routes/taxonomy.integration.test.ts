import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../server.js'
import { UserStore } from '../../users/UserStore.js'
import { BuildQueue } from '../../build/BuildQueue.js'
import type { BuildResult } from '../../build/BuildTrigger.js'

let app: FastifyInstance
let tmpDir: string

function makeMockBuildQueue(): BuildQueue {
  async function* noLines(): AsyncGenerator<string> { /* no output */ }
  return new BuildQueue(
    (_dir) => ({
      lines: noLines(),
      result: Promise.resolve<BuildResult>({ success: true, duration: 10, pages: 0, errors: [] }),
    }),
    '/mock-project',
  )
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-taxonomy-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  const pagesDir = path.join(contentDir, 'pages')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })

  // Page with tags: vue, javascript
  const page1Dir = path.join(pagesDir, '001--vue-intro')
  await mkdir(page1Dir, { recursive: true })
  await writeFile(
    path.join(page1Dir, 'index.mdx'),
    '---\ntitle: Vue Intro\nauthor: Alice\ntags:\n  - vue\n  - javascript\n---\nIntroduction to Vue.',
    'utf-8',
  )

  // Page with tags: vue, typescript
  const page2Dir = path.join(pagesDir, '002--vue-advanced')
  await mkdir(page2Dir, { recursive: true })
  await writeFile(
    path.join(page2Dir, 'index.mdx'),
    '---\ntitle: Vue Advanced\nauthor: Alice\ntags:\n  - vue\n  - typescript\n---\nAdvanced Vue topics.',
    'utf-8',
  )

  // Page with tags: typescript — authored by Bob
  const page3Dir = path.join(pagesDir, '003--typescript-basics')
  await mkdir(page3Dir, { recursive: true })
  await writeFile(
    path.join(page3Dir, 'index.mdx'),
    '---\ntitle: TypeScript Basics\nauthor: Bob\ntags:\n  - typescript\n---\nBasics of TypeScript.',
    'utf-8',
  )

  // Draft page (should not be indexed)
  const draftDir = path.join(pagesDir, '004--secret-draft')
  await mkdir(draftDir, { recursive: true })
  await writeFile(
    path.join(draftDir, 'index.mdx'),
    '---\ntitle: Secret Draft\npublished: false\ntags:\n  - secret\n---\nDraft content.',
    'utf-8',
  )

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    buildQueue: makeMockBuildQueue(),
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()
}, 15_000)

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('GET /api/taxonomy/tags', () => {
  it('returns taxonomy entries with correct counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags' })
    expect(res.statusCode).toBe(200)

    const tags: Array<{ value: string; count: number; slug: string }> = res.json()
    expect(Array.isArray(tags)).toBe(true)

    const vue = tags.find(t => t.value === 'vue')
    expect(vue).toBeDefined()
    expect(vue!.count).toBe(2)

    const ts = tags.find(t => t.value === 'typescript')
    expect(ts).toBeDefined()
    expect(ts!.count).toBe(2)

    const js = tags.find(t => t.value === 'javascript')
    expect(js).toBeDefined()
    expect(js!.count).toBe(1)
  })

  it('does not include tags from draft pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags' })
    expect(res.statusCode).toBe(200)

    const tags: Array<{ value: string }> = res.json()
    expect(tags.every(t => t.value !== 'secret')).toBe(true)
  })

  it('is publicly accessible (no auth required)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags' })
    expect(res.statusCode).toBe(200)
  })

  it('entries are sorted by count descending', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags' })
    const tags: Array<{ count: number }> = res.json()
    for (let i = 0; i < tags.length - 1; i++) {
      expect(tags[i]!.count).toBeGreaterThanOrEqual(tags[i + 1]!.count)
    }
  })

  it('entries include a url-safe slug field', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags' })
    const tags: Array<{ slug: string }> = res.json()
    for (const tag of tags) {
      expect(tag.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe('GET /api/taxonomy/tags/:tag', () => {
  it('returns entry and pages for a known tag', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags/vue' })
    expect(res.statusCode).toBe(200)

    const body: { entry: { value: string; count: number }; pages: Array<{ slug: string }> } = res.json()
    expect(body.entry.value).toBe('vue')
    expect(body.entry.count).toBe(2)
    expect(body.pages).toHaveLength(2)
    expect(body.pages.every((p: { slug: string; meta?: { tags?: string[] } }) => p.meta?.tags?.includes('vue'))).toBe(true)
  })

  it('returns only pages with that tag', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags/javascript' })
    expect(res.statusCode).toBe(200)

    const body: { pages: Array<{ slug: string }> } = res.json()
    expect(body.pages).toHaveLength(1)
    expect(body.pages[0]!.slug).toBe('vue-intro')
  })

  it('returns 404 for unknown tag', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/tags/nonexistent-tag-xyz' })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/taxonomy/authors', () => {
  it('returns authors with correct counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/authors' })
    expect(res.statusCode).toBe(200)

    const authors: Array<{ value: string; count: number; slug: string }> = res.json()
    expect(Array.isArray(authors)).toBe(true)

    const alice = authors.find(a => a.value === 'Alice')
    expect(alice).toBeDefined()
    expect(alice!.count).toBe(2)

    const bob = authors.find(a => a.value === 'Bob')
    expect(bob).toBeDefined()
    expect(bob!.count).toBe(1)
  })

  it('is publicly accessible (no auth required)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/authors' })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/taxonomy/authors/:author', () => {
  it('returns entry and pages for a known author', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/authors/Alice' })
    expect(res.statusCode).toBe(200)

    const body: { entry: { value: string; count: number }; pages: Array<{ slug: string }> } = res.json()
    expect(body.entry.value).toBe('Alice')
    expect(body.entry.count).toBe(2)
    expect(body.pages).toHaveLength(2)
  })

  it('returns 404 for unknown author', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy/authors/NonExistentAuthor' })
    expect(res.statusCode).toBe(404)
  })
})
