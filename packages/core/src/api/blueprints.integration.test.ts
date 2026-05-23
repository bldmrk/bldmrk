import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-bp-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
  await mkdir(configDir, { recursive: true })

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'secret123', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-key-minimum-32-chars!!',
    logger: false,
  })
  await app.ready()

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'secret123' },
  })
  authToken = (JSON.parse(login.body) as { accessToken: string }).accessToken
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('Blueprint API', () => {
  it('GET /api/blueprints returns scope lists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/blueprints',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { pages: string[]; config: string[] }
    expect(body.pages).toContain('default')
    expect(body.pages).toContain('blog')
    expect(body.config).toContain('site')
  })

  it('GET /api/blueprints/pages/default returns blueprint with tabs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/blueprints/pages/default',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { tabs: { id: string }[] }
    expect(body.tabs.map(t => t.id)).toContain('content')
    expect(body.tabs.map(t => t.id)).toContain('meta')
  })

  it('GET /api/blueprints/pages/blog resolves extends from default', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/blueprints/pages/blog',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { tabs: { id: string; fields: { name: string }[] }[] }
    const metaTab = body.tabs.find(t => t.id === 'meta')
    expect(metaTab?.fields.some(f => f.name === 'tags')).toBe(true)
  })

  it('GET /api/blueprints/pages/unknown returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/blueprints/pages/unknown',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/blueprints/config/site returns site config blueprint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/blueprints/config/site',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { name: string }
    expect(body.name).toBe('site')
  })

  it('GET /api/blueprints requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/blueprints' })
    expect(res.statusCode).toBe(401)
  })
})
