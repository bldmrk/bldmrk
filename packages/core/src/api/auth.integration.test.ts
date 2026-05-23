import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-auth-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
  await mkdir(configDir, { recursive: true })

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'correct-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('POST /api/auth/login', () => {
  it('returns accessToken and refreshToken on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'correct-password' },
      remoteAddress: '10.0.0.2',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('accessToken')
    expect(res.json()).toHaveProperty('refreshToken')
  })

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'wrong' },
      remoteAddress: '10.0.0.3',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 on unknown email', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'nobody@test.com', password: 'any' },
      remoteAddress: '10.0.0.4',
    })
    expect(res.statusCode).toBe(401)
  })

  it('rate-limits after 5 attempts from same IP', async () => {
    const ip = '10.99.1.1'
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: 'x@x.com', password: 'wrong' },
        remoteAddress: ip,
      })
    }
    const blocked = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'x@x.com', password: 'wrong' },
      remoteAddress: ip,
    })
    expect(blocked.statusCode).toBe(429)
  })
})

describe('POST /api/auth/refresh', () => {
  it('returns new accessToken with valid refreshToken', async () => {
    const loginRes = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'correct-password' },
      remoteAddress: '10.0.0.5',
    })
    const { refreshToken } = loginRes.json()
    const res = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('accessToken')
  })

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/refresh',
      payload: { refreshToken: 'not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})
