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

const CONTACT_BLUEPRINT_YAML = `
name: contact
fields:
  - name: name
    type: text
    label: Full Name
    required: true
  - name: email
    type: email
    label: Email Address
    required: true
  - name: message
    type: textarea
    label: Message
    required: false
actions:
  save:
    enabled: true
    path: content/data/forms
honeypot: _gotcha
rateLimit: 3
`.trim()

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
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-forms-test-'))
  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  const formsDir = path.join(contentDir, 'forms')
  const pagesDir = path.join(contentDir, 'pages')

  await mkdir(pagesDir, { recursive: true })
  await mkdir(configDir, { recursive: true })
  await mkdir(formsDir, { recursive: true })

  await writeFile(path.join(formsDir, 'contact.yaml'), CONTACT_BLUEPRINT_YAML, 'utf-8')

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({
    contentDir,
    configDir,
    projectDir: tmpDir,
    port: 0,
    jwtSecret: 'test-secret-32-chars-minimum-ok!!',
    buildQueue: makeMockBuildQueue(),
    corsOrigins: ['http://localhost:5173'],
    logger: false,
  })
  await app.ready()
}, 15_000)

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('GET /api/forms', () => {
  it('returns list of forms without action credentials', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/forms' })
    expect(res.statusCode).toBe(200)

    const forms: Array<{ name: string }> = res.json()
    expect(Array.isArray(forms)).toBe(true)
    expect(forms.some(f => f.name === 'contact')).toBe(true)
  })
})

describe('GET /api/forms/:name', () => {
  it('returns blueprint for known form', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/forms/contact' })
    expect(res.statusCode).toBe(200)

    const form: { name: string; fields: unknown[] } = res.json()
    expect(form.name).toBe('contact')
    expect(form.fields).toHaveLength(3)
  })

  it('returns 404 for unknown form', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/forms/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/forms/:name/submit', () => {
  it('returns 200 for valid submission', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/contact/submit',
      payload: {
        name: 'Alice',
        email: 'alice@example.com',
        message: 'Hello!',
      },
    })
    expect(res.statusCode).toBe(200)
    const body: { success: boolean } = res.json()
    expect(body.success).toBe(true)
  })

  it('returns 422 with error details when required field is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/contact/submit',
      payload: {
        email: 'alice@example.com',
        // name is missing
      },
    })
    expect(res.statusCode).toBe(422)
    const body: { errors: Array<{ field: string; message: string }> } = res.json()
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors.some(e => e.field === 'name')).toBe(true)
  })

  it('returns 422 with error details when email is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/contact/submit',
      payload: {
        name: 'Bob',
        email: 'not-an-email',
      },
    })
    expect(res.statusCode).toBe(422)
    const body: { errors: Array<{ field: string }> } = res.json()
    expect(body.errors.some(e => e.field === 'email')).toBe(true)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const ip = '10.10.10.10'
    // rateLimit is 3 in the blueprint, submit 3 times to exhaust
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/forms/contact/submit',
        headers: { 'x-forwarded-for': ip },
        payload: { name: 'Spammer', email: 'spam@example.com' },
      })
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/contact/submit',
      headers: { 'x-forwarded-for': ip },
      payload: { name: 'Spammer', email: 'spam@example.com' },
    })
    expect(res.statusCode).toBe(429)
  })

  it('returns 404 for unknown form', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/nonexistent/submit',
      payload: { name: 'Alice' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('silently succeeds when honeypot is filled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/forms/contact/submit',
      payload: {
        name: 'Bot',
        email: 'bot@example.com',
        _gotcha: 'I am a robot',
      },
    })
    expect(res.statusCode).toBe(200)
    const body: { success: boolean } = res.json()
    expect(body.success).toBe(true)
  })
})
