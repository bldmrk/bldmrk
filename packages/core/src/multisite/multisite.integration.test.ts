import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../api/server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string
let singleApp: FastifyInstance
let singleTmpDir: string

beforeAll(async () => {
  // ---- Multi-site setup ----
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-multisite-test-'))

  // Create two site directories
  const siteAContentDir = path.join(tmpDir, 'sites', 'site-a.com', 'content')
  const siteBContentDir = path.join(tmpDir, 'sites', 'site-b.com', 'content')
  const siteAConfigDir = path.join(tmpDir, 'sites', 'site-a.com')
  const siteBConfigDir = path.join(tmpDir, 'sites', 'site-b.com')

  await mkdir(path.join(siteAContentDir, 'pages'), { recursive: true })
  await mkdir(path.join(siteBContentDir, 'pages'), { recursive: true })
  await mkdir(siteAConfigDir, { recursive: true })
  await mkdir(siteBConfigDir, { recursive: true })

  // Create a page in site A
  const siteAPageDir = path.join(siteAContentDir, 'pages', '001--site-a-home')
  await mkdir(siteAPageDir, { recursive: true })
  await writeFile(
    path.join(siteAPageDir, 'index.mdx'),
    '---\ntitle: Site A Home\n---\n# Site A Home\n',
    'utf-8',
  )

  // Create a page in site B
  const siteBPageDir = path.join(siteBContentDir, 'pages', '001--site-b-home')
  await mkdir(siteBPageDir, { recursive: true })
  await writeFile(
    path.join(siteBPageDir, 'index.mdx'),
    '---\ntitle: Site B Home\n---\n# Site B Home\n',
    'utf-8',
  )

  // Create bldmrk.config.yaml
  const bldmrkConfigPath = path.join(tmpDir, 'bldmrk.config.yaml')
  await writeFile(
    bldmrkConfigPath,
    `sites:\n  - domain: site-a.com\n    aliases:\n      - www.site-a.com\n  - domain: site-b.com\n`,
    'utf-8',
  )

  // Create users for both sites (needed for auth routes, not for page listing)
  const userStoreA = new UserStore(path.join(siteAConfigDir, 'users.yaml'))
  await userStoreA.create({ email: 'admin@site-a.com', password: 'test-password', role: 'admin' })
  const userStoreB = new UserStore(path.join(siteBConfigDir, 'users.yaml'))
  await userStoreB.create({ email: 'admin@site-b.com', password: 'test-password', role: 'admin' })

  // Use site-a.com as the "single site" config for the main server in multisite mode
  app = await createApp({
    contentDir: siteAContentDir,
    configDir: siteAConfigDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    projectDir: tmpDir,
    multisite: {
      enabled: true,
      configPath: bldmrkConfigPath,
    },
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()

  // ---- Single-site setup (for backward compat test) ----
  singleTmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-single-test-'))
  const singleContentDir = path.join(singleTmpDir, 'content')
  const singleConfigDir = path.join(singleTmpDir, 'config')
  await mkdir(path.join(singleContentDir, 'pages'), { recursive: true })
  await mkdir(singleConfigDir, { recursive: true })

  const singlePageDir = path.join(singleContentDir, 'pages', '001--home')
  await mkdir(singlePageDir, { recursive: true })
  await writeFile(
    path.join(singlePageDir, 'index.mdx'),
    '---\ntitle: Single Site Home\n---\n# Single Site Home\n',
    'utf-8',
  )

  const singleUserStore = new UserStore(path.join(singleConfigDir, 'users.yaml'))
  await singleUserStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  singleApp = await createApp({
    contentDir: singleContentDir,
    configDir: singleConfigDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await singleApp.ready()
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
  await singleApp.close()
  await rm(singleTmpDir, { recursive: true })
})

describe('Multi-site mode', () => {
  it('returns 404 for unknown host', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { host: 'unknown.com' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'Site not configured' })
  })

  it('accepts requests for site-a.com host', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { host: 'site-a.com' },
    })
    // The route may return any 2xx or redirect — just not a multisite 404
    expect(res.statusCode).not.toBe(404)
  })

  it('accepts requests for site-b.com host', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { host: 'site-b.com' },
    })
    expect(res.statusCode).not.toBe(404)
  })

  it('accepts requests for www.site-a.com alias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pages',
      headers: { host: 'www.site-a.com' },
    })
    expect(res.statusCode).not.toBe(404)
  })

  it('hub endpoint lists configured sites', async () => {
    const originalToken = process.env.FOLIO_HUB_TOKEN
    process.env.FOLIO_HUB_TOKEN = 'test-hub-token-123'
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/__hub/api/sites',
        headers: { 'x-hub-token': 'test-hub-token-123', host: 'site-a.com' },
      })
      expect(res.statusCode).toBe(200)
      const sites = res.json() as { id: string }[]
      expect(Array.isArray(sites)).toBe(true)
      expect(sites.length).toBeGreaterThanOrEqual(2)
      expect(sites.map((s: { id: string }) => s.id)).toContain('site-a.com')
    } finally {
      if (originalToken === undefined) {
        delete process.env.FOLIO_HUB_TOKEN
      } else {
        process.env.FOLIO_HUB_TOKEN = originalToken
      }
    }
  })

  it('hub endpoint returns 503 when FOLIO_HUB_TOKEN not set', async () => {
    const originalToken = process.env.FOLIO_HUB_TOKEN
    delete process.env.FOLIO_HUB_TOKEN
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/__hub/api/sites',
        headers: { host: 'site-a.com' },
      })
      expect(res.statusCode).toBe(503)
    } finally {
      if (originalToken !== undefined) {
        process.env.FOLIO_HUB_TOKEN = originalToken
      }
    }
  })
})

describe('Single-site mode (backward compatibility)', () => {
  it('GET /api/pages works without Host-based routing', async () => {
    const res = await singleApp.inject({
      method: 'GET',
      url: '/api/pages',
    })
    // Should not get a multisite 404
    expect(res.statusCode).not.toBe(404)
    // Body should not be the multisite error
    if (res.statusCode === 404) {
      expect(res.json()).not.toMatchObject({ error: 'Site not configured' })
    }
  })

  it('auth route still works in single-site mode', async () => {
    const res = await singleApp.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'test-password' },
      remoteAddress: '127.0.0.1',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('accessToken')
  })
})
