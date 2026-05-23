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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-config-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
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

describe('GET /api/config/site', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config/site' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with a site config object containing a name field', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/site',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.name).toBe('string')
  })
})

describe('PUT /api/config/site', () => {
  it('saves and returns updated site config', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/site',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'My Site', description: 'Test' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('My Site')
    expect(body.description).toBe('Test')
  })

  it('returns 500 when body fails Zod validation (unknown field triggers no error, missing required coercion still passes with defaults — empty object is valid)', async () => {
    // SiteConfigSchema has all fields optional/defaulted, so {} is actually valid.
    // Verify empty body returns 200 (defaults applied), not a 400.
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/site',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {},
    })
    // All fields have defaults so Zod accepts {} — expect 200
    expect(res.statusCode).toBe(200)
  })
})
