import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'

const JWT_SECRET = 'test-secret-32-chars-minimum-ok!!'

let tmpDir: string

async function makeTmpDirs(prefix: string): Promise<{ contentDir: string; configDir: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix))
  const contentDir = path.join(dir, 'content')
  const configDir = path.join(dir, 'config')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
  await mkdir(configDir, { recursive: true })
  return { contentDir, configDir }
}

describe('createApp()', () => {
  let app: FastifyInstance
  let contentDir: string
  let configDir: string

  beforeAll(async () => {
    const dirs = await makeTmpDirs('bldmrk-server-test-')
    tmpDir = path.dirname(dirs.contentDir)
    contentDir = dirs.contentDir
    configDir = dirs.configDir

    app = await createApp({
      contentDir,
      configDir,
      port: 0,
      jwtSecret: JWT_SECRET,
      logger: false,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await rm(tmpDir, { recursive: true })
  })

  it('createApp() resolves without throwing', () => {
    // If we reached this point, createApp() succeeded
    expect(app).toBeDefined()
  })

  it('GET /health returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })
})

describe('createApp() without multisite option', () => {
  let app: FastifyInstance
  let localTmpDir: string

  beforeAll(async () => {
    const dirs = await makeTmpDirs('bldmrk-server-single-')
    localTmpDir = path.dirname(dirs.contentDir)

    // No multisite key at all — single-site mode
    app = await createApp({
      contentDir: dirs.contentDir,
      configDir: dirs.configDir,
      port: 0,
      jwtSecret: JWT_SECRET,
      logger: false,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await rm(localTmpDir, { recursive: true })
  })

  it('starts in single-site mode without crashing', () => {
    expect(app).toBeDefined()
  })

  it('GET /health still responds in single-site mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })
})
