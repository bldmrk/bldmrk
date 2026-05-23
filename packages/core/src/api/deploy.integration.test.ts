import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'
import { BuildQueue } from '../build/BuildQueue.js'
import type { BuildResult } from '../build/BuildTrigger.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string
let buildQueue: BuildQueue

function makeMockBuildQueue(): BuildQueue {
  async function* noLines(): AsyncGenerator<string> { /* no output */ }
  return new BuildQueue(
    (_dir) => ({
      lines: noLines(),
      result: Promise.resolve<BuildResult>({ success: true, duration: 10, pages: 3, errors: [] }),
    }),
    '/mock-project',
  )
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-deploy-test-'))
  const configDir = path.join(tmpDir, 'config')
  const contentDir = path.join(tmpDir, 'content')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
  await mkdir(configDir, { recursive: true })

  buildQueue = makeMockBuildQueue()

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    buildQueue,
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/deploy/netlify — no config', () => {
  it('returns 503 when netlify URL is not configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/deploy/netlify',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.message).toMatch(/not configured/i)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/deploy/netlify' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/deploy/netlify — with config', () => {
  let appWithDeploy: FastifyInstance
  let tmpDirDeploy: string
  let tokenDeploy: string

  beforeAll(async () => {
    tmpDirDeploy = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-deploy-cfg-'))
    const configDir = path.join(tmpDirDeploy, 'config')
    const contentDir = path.join(tmpDirDeploy, 'content')
    await mkdir(path.join(contentDir, 'pages'), { recursive: true })
    await mkdir(configDir, { recursive: true })

    // Write system.yaml with deploy config
    await writeFile(
      path.join(configDir, 'system.yaml'),
      'deploy:\n  netlify:\n    url: https://api.netlify.com/build_hooks/test123\n',
      'utf-8',
    )

    const bq = makeMockBuildQueue()
    const userStore = new UserStore(path.join(configDir, 'users.yaml'))
    await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

    appWithDeploy = await createApp({
      contentDir,
      configDir,
      port: 0,
      jwtSecret: 'test-secret-32-chars-minimum-ok!!',
      buildQueue: bq,
      corsOrigins: ['http://localhost:5173'],
      logger: false,
    })
    await appWithDeploy.ready()

    const loginRes = await appWithDeploy.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'test-password' },
      remoteAddress: '127.0.0.1',
    })
    tokenDeploy = loginRes.json().accessToken
  }, 15_000)

  afterAll(async () => {
    await appWithDeploy.close()
    await rm(tmpDirDeploy, { recursive: true })
  })

  it('returns 200 with triggered:true when URL is configured (mocked fetch)', async () => {
    // Mock global fetch to simulate the outgoing webhook call
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    )

    const res = await appWithDeploy.inject({
      method: 'POST',
      url: '/api/deploy/netlify',
      headers: { authorization: `Bearer ${tokenDeploy}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ triggered: true, provider: 'netlify' })
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.netlify.com/build_hooks/test123')
  })
})

describe('POST /api/deploy/vercel — no config', () => {
  it('returns 503 when vercel URL is not configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/deploy/vercel',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.message).toMatch(/not configured/i)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/deploy/vercel' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/deploy/status', () => {
  it('returns deploy status object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/deploy/status',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('netlify')
    expect(body).toHaveProperty('vercel')
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/deploy/status' })
    expect(res.statusCode).toBe(401)
  })
})
