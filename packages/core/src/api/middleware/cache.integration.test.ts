import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../server.js'
import { UserStore } from '../../users/UserStore.js'
import { MemoryCache } from '../../cache/MemoryCache.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-cache-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  const pagesDir = path.join(contentDir, 'pages')
  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })

  // Seed a page for GET /api/pages to return data
  const pageDir = path.join(pagesDir, '001--test-page')
  await mkdir(pageDir, { recursive: true })
  await writeFile(path.join(pageDir, 'index.mdx'), '# Test Page', 'utf-8')
  await writeFile(path.join(pageDir, 'page.yaml'), 'title: Test Page\n', 'utf-8')

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  const cacheStore = new MemoryCache({ ttl: 60, maxSize: 500 })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    cacheStore,
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'test-password' },
    remoteAddress: '127.0.0.1',
  })
  authToken = loginRes.json().accessToken
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('Cache middleware integration', () => {
  it('first GET /api/pages returns X-Cache: MISS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-cache']).toBe('MISS')
  })

  it('second GET /api/pages returns X-Cache: HIT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-cache']).toBe('HIT')
  })

  it('POST /api/pages invalidates cache so next GET returns X-Cache: MISS', async () => {
    // Create a new page — this should invalidate the pages cache
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { slug: 'cache-test-page', title: 'Cache Test', content: '# Cache' },
    })
    expect(postRes.statusCode).toBe(201)

    // Next GET should be a cache miss
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(getRes.statusCode).toBe(200)
    expect(getRes.headers['x-cache']).toBe('MISS')
  })

  it('GET /api/cache/stats returns hit/miss counts (admin only)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.hits).toBe('number')
    expect(typeof body.misses).toBe('number')
    expect(typeof body.hitRate).toBe('number')
  })

  it('POST /api/cache/clear clears the cache', async () => {
    // Warm up cache
    await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })

    // Clear
    const clearRes = await app.inject({
      method: 'POST',
      url: '/api/cache/clear',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(clearRes.statusCode).toBe(200)
    expect(clearRes.json().cleared).toBe(true)

    // Next request should be a miss
    const afterClear = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(afterClear.headers['x-cache']).toBe('MISS')
  })
})
