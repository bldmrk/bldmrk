import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'

let hubApp: FastifyInstance
let hubTmpDir: string

beforeAll(async () => {
  hubTmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-hub-test-'))

  // SiteRegistry appends /content to the contentDir supplied in YAML,
  // so we give it a site root and create content/pages under it.
  const siteARoot = path.join(hubTmpDir, 'site-a')
  const siteBRoot = path.join(hubTmpDir, 'site-b')
  await mkdir(path.join(siteARoot, 'content', 'pages'), { recursive: true })
  await mkdir(path.join(siteBRoot, 'content', 'pages'), { recursive: true })

  const configPath = path.join(hubTmpDir, 'bldmrk.config.yaml')
  await writeFile(
    configPath,
    yaml.dump({
      sites: [
        { domain: 'site-a.com', contentDir: siteARoot },
        { domain: 'site-b.com', contentDir: siteBRoot },
      ],
      sharedPlugins: [],
    }),
  )

  hubApp = await createApp({
    contentDir: siteARoot,
    configDir: hubTmpDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    logger: false,
    multisite: { enabled: true, configPath },
  })
  await hubApp.ready()
})

afterAll(async () => {
  delete process.env.FOLIO_HUB_TOKEN
  await hubApp.close()
  await rm(hubTmpDir, { recursive: true })
})

describe('GET /__hub/api/sites (no FOLIO_HUB_TOKEN env)', () => {
  it('returns 503 when FOLIO_HUB_TOKEN is not configured', async () => {
    delete process.env.FOLIO_HUB_TOKEN
    const res = await hubApp.inject({
      method: 'GET',
      url: '/__hub/api/sites',
    })
    expect(res.statusCode).toBe(503)
  })
})

describe('Hub routes with FOLIO_HUB_TOKEN set', () => {
  beforeAll(() => {
    process.env.FOLIO_HUB_TOKEN = 'test-hub-token'
  })

  afterAll(() => {
    delete process.env.FOLIO_HUB_TOKEN
  })

  it('GET /__hub/api/sites without x-hub-token header returns 401', async () => {
    const res = await hubApp.inject({
      method: 'GET',
      url: '/__hub/api/sites',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /__hub/api/sites with correct token returns 200 and array of 2 sites', async () => {
    const res = await hubApp.inject({
      method: 'GET',
      url: '/__hub/api/sites',
      headers: { 'x-hub-token': 'test-hub-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('POST /__hub/api/sites/site-a.com/build with correct token returns 200 with queued status', async () => {
    const res = await hubApp.inject({
      method: 'POST',
      url: '/__hub/api/sites/site-a.com/build',
      headers: { 'x-hub-token': 'test-hub-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ status: 'queued' })
    expect(body).toHaveProperty('siteId')
    expect(body).toHaveProperty('triggeredAt')
  })

  it('POST /__hub/api/sites/unknown.com/build returns 404', async () => {
    const res = await hubApp.inject({
      method: 'POST',
      url: '/__hub/api/sites/unknown.com/build',
      headers: { 'x-hub-token': 'test-hub-token' },
    })
    expect(res.statusCode).toBe(404)
  })
})
