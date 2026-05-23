import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, readdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string
let pagesDir: string

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-pages-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  pagesDir = path.join(contentDir, 'pages')
  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()

  const loginRes = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'test-password' },
    remoteAddress: '127.0.0.1',
  })
  authToken = loginRes.json().accessToken
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('POST /api/pages', () => {
  it('creates page folder on disk and returns 201 with PageObject', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { slug: 'my-page', title: 'My Page', content: '# Hello' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.slug).toBe('my-page')
    expect(body.meta.title).toBe('My Page')
    const entries = await readdir(pagesDir)
    expect(entries.some(e => e.endsWith('--my-page'))).toBe(true)
  })

  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pages',
      payload: { slug: 'unauthorized' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/pages', () => {
  it('returns array containing previously created page', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pages',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const pages: Array<{ slug: string }> = res.json()
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.some(p => p.slug === 'my-page')).toBe(true)
  })
})

describe('GET /api/pages/:slug', () => {
  it('returns correct PageObject for known slug', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pages/my-page',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().slug).toBe('my-page')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pages/does-not-exist',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('PUT /api/pages/:slug', () => {
  it('updates content on disk and returns updated PageObject', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/pages/my-page',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { content: '# Updated', title: 'Updated Title' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().meta.title).toBe('Updated Title')
  })
})

describe('PATCH /api/pages/reorder', () => {
  it('renames folder prefix to match requested order', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/pages/reorder',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { items: [{ slug: 'my-page', order: 5 }] },
    })
    expect(res.statusCode).toBe(204)
    const entries = await readdir(pagesDir)
    expect(entries).toContain('005--my-page')
  })
})

describe('DELETE /api/pages/:slug', () => {
  it('removes folder from disk and returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/pages/my-page',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(204)
    const entries = await readdir(pagesDir)
    expect(entries.some(e => e.endsWith('--my-page'))).toBe(false)
  })
})
