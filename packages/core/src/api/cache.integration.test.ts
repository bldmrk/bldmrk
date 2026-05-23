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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-cache-test-'))
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

describe('GET /api/cache/stats', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cache/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('returns stats object with numeric fields when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.hits).toBe('number')
    expect(typeof body.misses).toBe('number')
    expect(typeof body.size).toBe('number')
    expect(typeof body.hitRate).toBe('number')
  })
})

describe('POST /api/cache/clear', () => {
  it('returns 200 when authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/clear',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('stats show size 0 after cache is cleared', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/cache/clear',
      headers: { authorization: `Bearer ${authToken}` },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/stats',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().size).toBe(0)
  })
})
