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
let authToken: string

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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-backup-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  const pagesDir = path.join(contentDir, 'pages')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })

  await writeFile(
    path.join(pagesDir, 'index.mdx'),
    '---\ntitle: Test Page\n---\nHello world.',
    'utf-8',
  )

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    buildQueue: makeMockBuildQueue(),
    projectDir: tmpDir,
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()

  // Obtain auth token
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'test-password' },
  })
  const loginBody = loginRes.json()
  authToken = loginBody.accessToken
}, 30_000)

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('POST /api/backup', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/backup',
      payload: { type: 'content' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('creates a backup and returns BackupMeta', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/backup',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { type: 'content' },
    })
    expect(res.statusCode).toBe(200)
    const meta = res.json()
    expect(meta.id).toMatch(/^bldmrk-backup-content-/)
    expect(meta.type).toBe('content')
    expect(typeof meta.sizeBytes).toBe('number')
    expect(meta.sizeBytes).toBeGreaterThan(0)
  }, 30_000)
})

describe('GET /api/backup', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/backup' })
    expect(res.statusCode).toBe(401)
  })

  it('returns list of backups', async () => {
    // Ensure at least one backup exists
    await app.inject({
      method: 'POST',
      url: '/api/backup',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { type: 'content' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/backup',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const list = res.json()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  }, 30_000)
})

describe('DELETE /api/backup/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/backup/nonexistent' })
    expect(res.statusCode).toBe(401)
  })

  it('deletes a backup and returns 204', async () => {
    // Create a backup first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/backup',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { type: 'content' },
    })
    const { id } = createRes.json()

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/backup/${id}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(deleteRes.statusCode).toBe(204)

    // Verify it's gone
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/backup',
      headers: { authorization: `Bearer ${authToken}` },
    })
    const list = listRes.json()
    expect(list.find((b: { id: string }) => b.id === id)).toBeUndefined()
  }, 30_000)

  it('returns 404 for non-existent backup', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/backup/nonexistent-backup-id',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
