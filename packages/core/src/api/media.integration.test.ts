import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, readdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import sharp from 'sharp'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string
let mediaDir: string
let pagesDir: string
let testJpeg: Buffer

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-media-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  mediaDir = path.join(contentDir, 'media')
  pagesDir = path.join(contentDir, 'pages')
  await mkdir(mediaDir, { recursive: true })
  await mkdir(pagesDir, { recursive: true })
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
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'test-password' },
    remoteAddress: '127.0.0.1',
  })
  authToken = loginRes.json().accessToken

  testJpeg = await sharp({
    create: { width: 100, height: 80, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).jpeg().toBuffer()
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('POST /api/media', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/media',
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
      payload: '--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n\r\n--boundary--',
    })
    expect(res.statusCode).toBe(401)
  })

  it('uploads JPEG and returns 201 with metadata', async () => {
    const boundary = 'testboundary123'
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpeg,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const res = await app.inject({
      method: 'POST', url: '/api/media',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeTruthy()
    expect(body.filename).toBeTruthy()
    expect(body.url).toBeTruthy()
    expect(body.webpUrl).toBeTruthy()
    expect(body.width).toBeGreaterThan(0)
    expect(body.height).toBeGreaterThan(0)
    expect(body.size).toBeGreaterThan(0)
  })

  it('stores original file in content/media/', async () => {
    const boundary = 'testboundary456'
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="stored.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpeg,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    await app.inject({
      method: 'POST', url: '/api/media',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    })

    const files = await readdir(mediaDir)
    expect(files.some(f => f.endsWith('.jpg'))).toBe(true)
  })

  it('creates WebP variant automatically', async () => {
    const boundary = 'testboundarywebp'
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="webptest.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpeg,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const res = await app.inject({
      method: 'POST', url: '/api/media',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    })

    const { webpUrl } = res.json()
    const files = await readdir(mediaDir)
    const webpFilename = path.basename(webpUrl)
    expect(files).toContain(webpFilename)
  })

  it('stores in page media dir when pageId is provided', async () => {
    const pageSlug = 'test-page'
    const pageMediaDir = path.join(pagesDir, pageSlug, 'media')
    await mkdir(pageMediaDir, { recursive: true })

    const boundary = 'testboundarypageid'
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="pageimg.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpeg,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="pageId"\r\n\r\n${pageSlug}\r\n--${boundary}--`),
    ])

    const res = await app.inject({
      method: 'POST', url: '/api/media',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    })

    expect(res.statusCode).toBe(201)
    const files = await readdir(pageMediaDir)
    expect(files.some(f => f.endsWith('.jpg'))).toBe(true)
  })
})

describe('GET /api/media', () => {
  it('returns array containing uploaded files', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/media',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/media' })
    expect(res.statusCode).toBe(401)
  })
})

describe('DELETE /api/media/:id', () => {
  it('deletes files and returns 204', async () => {
    const boundary = 'testboundarydel'
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="todelete.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      testJpeg,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const uploadRes = await app.inject({
      method: 'POST', url: '/api/media',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    })
    const { id } = uploadRes.json()

    const deleteRes = await app.inject({
      method: 'DELETE', url: `/api/media/${id}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(deleteRes.statusCode).toBe(204)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/media/someid' })
    expect(res.statusCode).toBe(401)
  })
})
