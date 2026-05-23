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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-git-api-test-'))
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
    projectDir: tmpDir,
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
}, 15_000)

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('GET /api/git/log', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/git/log' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an array of commits', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/git/log',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

describe('GET /api/git/log?file=<slug>', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/git/log?file=home' })
    expect(res.statusCode).toBe(401)
  })

  it('returns an array (empty ok) when slug has no commits', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/git/log?file=nonexistent-slug',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

describe('GET /api/git/show/:hash', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/git/show/abc1234?file=home' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for unknown hash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/git/show/0000000?file=home',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/git/restore', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/git/restore',
      payload: { hash: '0000000', slug: 'home' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for unknown hash/slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/git/restore',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { hash: '0000000', slug: 'nonexistent' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/git/status', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/git/status' })
    expect(res.statusCode).toBe(401)
  })

  it('returns modified, added, deleted arrays', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/git/status',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('modified')
    expect(body).toHaveProperty('added')
    expect(body).toHaveProperty('deleted')
    expect(Array.isArray(body.modified)).toBe(true)
    expect(Array.isArray(body.added)).toBe(true)
    expect(Array.isArray(body.deleted)).toBe(true)
  })
})
