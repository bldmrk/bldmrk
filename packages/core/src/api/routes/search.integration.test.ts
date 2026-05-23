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
let pagesDir: string

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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-search-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  pagesDir = path.join(contentDir, 'pages')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })

  // Create a test page
  const pageDir = path.join(pagesDir, '001--hello-world')
  await mkdir(pageDir, { recursive: true })
  await writeFile(
    path.join(pageDir, 'index.mdx'),
    '---\ntitle: Hello World\n---\nThis is an incredible greeting page with unique content.',
    'utf-8',
  )

  // Create a second page for limit testing
  for (let i = 2; i <= 5; i++) {
    const dir = path.join(pagesDir, `00${i}--page-${i}`)
    await mkdir(dir, { recursive: true })
    await writeFile(
      path.join(dir, 'index.mdx'),
      `---\ntitle: Page ${i}\n---\nIncredible unique content on page number ${i}.`,
      'utf-8',
    )
  }

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

describe('GET /api/search', () => {
  it('finds an indexed page by keyword', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=incredible+greeting',
    })
    expect(res.statusCode).toBe(200)
    const results = res.json()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe('hello-world')
    expect(results[0].title).toBe('Hello World')
    expect(results[0].excerpt).toBeDefined()
  })

  it('returns empty array for empty query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns empty array when no q param provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('respects the limit parameter', async () => {
    // Search for something that would match all pages
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=incredible+unique&limit=2',
    })
    expect(res.statusCode).toBe(200)
    const results = res.json()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('is publicly accessible (no auth required)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=hello',
    })
    // Should not be 401
    expect(res.statusCode).toBe(200)
  })
})
