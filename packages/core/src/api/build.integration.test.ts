import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir } from 'fs/promises'
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

// Mock trigger that resolves immediately with a successful build (no debounce wait needed)
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

/** Wait for the queue to reach 'done' or 'error', subscribing before enqueueing. */
function waitForBuildComplete(queue: BuildQueue): { enqueueAndWait: () => Promise<string[]> } {
  return {
    enqueueAndWait: () => {
      const statuses: string[] = []
      return new Promise<string[]>((resolve) => {
        const unsub = queue.onStatusChange((u) => {
          statuses.push(u.status)
          if (u.status === 'done' || u.status === 'error') {
            unsub()
            resolve(statuses)
          }
        })
        queue.enqueue()
      })
    },
  }
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-build-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
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

describe('POST /api/build', () => {
  it('returns 202 and queued:true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/build',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ queued: true })
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/build' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/build/history', () => {
  it('returns an array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/build/history',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/build/history' })
    expect(res.statusCode).toBe(401)
  })

  it('contains a build result after a build completes', async () => {
    // Note: BuildQueue has a 500ms debounce before actually running the build.
    // We subscribe before enqueueing to avoid a race between enqueue() and subscribe.
    const { enqueueAndWait } = waitForBuildComplete(buildQueue)
    await enqueueAndWait()

    const res = await app.inject({
      method: 'GET',
      url: '/api/build/history',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const history = res.json()
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]).toMatchObject({ success: true, pages: 3 })
  }, 10_000)
})

describe('GET /api/build/status (SSE)', () => {
  // Fastify's app.inject() does not support streaming for SSE endpoints.
  // These tests verify the underlying BuildQueue observable behaviour that the
  // SSE route streams, which is the correct integration-testing approach.

  it('emits building then done status events when a build runs', async () => {
    const { enqueueAndWait } = waitForBuildComplete(buildQueue)
    const statuses = await enqueueAndWait()

    expect(statuses).toContain('building')
    expect(statuses).toContain('done')
  }, 10_000)

  it('GET /api/build/status returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/build/status' })
    expect(res.statusCode).toBe(401)
  })
})
