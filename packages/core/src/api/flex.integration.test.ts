import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import type { FastifyInstance } from 'fastify'
import { createApp } from './server.js'
import { UserStore } from '../users/UserStore.js'

let app: FastifyInstance
let tmpDir: string
let authToken: string
let contentDir: string

const PRODUCTS_SCHEMA = `
name: products
label: Products
labelField: name
public: false
fields:
  - name: name
    type: text
    label: Product Name
    required: true
  - name: price
    type: number
    label: Price
    required: true
  - name: description
    type: textarea
    label: Description
    required: false
admin:
  list:
    - name
    - price
  sort: name
`.trim()

const PUBLIC_SCHEMA = `
name: testimonials
label: Testimonials
labelField: author
public: true
fields:
  - name: author
    type: text
    label: Author
    required: true
  - name: quote
    type: textarea
    label: Quote
    required: true
`.trim()

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-flex-test-'))
  contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(tmpDir, 'config')
  await mkdir(path.join(contentDir, 'pages'), { recursive: true })
  await mkdir(configDir, { recursive: true })

  // Set up flex schemas
  const flexProductsDir = path.join(contentDir, 'flex', 'products')
  const flexTestimonialsDir = path.join(contentDir, 'flex', 'testimonials')
  await mkdir(flexProductsDir, { recursive: true })
  await mkdir(flexTestimonialsDir, { recursive: true })
  await writeFile(path.join(flexProductsDir, '_schema.yaml'), PRODUCTS_SCHEMA, 'utf-8')
  await writeFile(path.join(flexTestimonialsDir, '_schema.yaml'), PUBLIC_SCHEMA, 'utf-8')

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test-password', role: 'admin' })

  app = await createApp({ contentDir, configDir, port: 0, jwtSecret: 'test-secret-32-chars-minimum-ok!!', corsOrigins: ['http://localhost:5173'], logger: false })
  await app.ready()

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'test-password' },
    remoteAddress: '127.0.0.1',
  })
  authToken = loginRes.json().accessToken
})

afterAll(async () => {
  await app.close()
  await rm(tmpDir, { recursive: true })
})

describe('GET /api/flex', () => {
  it('returns all flex types (admin only)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/flex',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const types = res.json() as { name: string }[]
    expect(Array.isArray(types)).toBe(true)
    expect(types.some(t => t.name === 'products')).toBe(true)
    expect(types.some(t => t.name === 'testimonials')).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/flex' })
    expect(res.statusCode).toBe(401)
  })
})

describe('Full CRUD cycle for /api/flex/:type', () => {
  let createdId: string

  it('POST creates a new entry and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/flex/products',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Widget Pro', price: 49.99, description: 'Best widget ever' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; typeName: string; data: Record<string, unknown> }
    expect(body.id).toBe('widget-pro')
    expect(body.typeName).toBe('products')
    expect(body.data['name']).toBe('Widget Pro')
    createdId = body.id
  })

  it('GET /api/flex/:type lists entries (requires auth for private type)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/flex/products',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const entries = res.json() as { id: string }[]
    expect(entries.some(e => e.id === createdId)).toBe(true)
  })

  it('GET /api/flex/:type returns 401 without auth for private type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/flex/products' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/flex/:type/:id returns a single entry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/flex/products/${createdId}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { id: string; data: Record<string, unknown> }
    expect(body.id).toBe(createdId)
    expect(body.data['name']).toBe('Widget Pro')
  })

  it('PUT updates an existing entry', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/flex/products/${createdId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Widget Pro v2', price: 59.99, description: 'Updated' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, unknown> }
    expect(body.data['name']).toBe('Widget Pro v2')
    expect(body.data['price']).toBe(59.99)
  })

  it('DELETE removes the entry', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/flex/products/${createdId}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('GET after DELETE returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/flex/products/${createdId}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('Validation errors', () => {
  it('POST with missing required field returns 422 with field errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/flex/products',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { description: 'no name or price' },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json() as { errors: { field: string; message: string }[] }
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors.some(e => e.field === 'name')).toBe(true)
    expect(body.errors.some(e => e.field === 'price')).toBe(true)
  })

  it('PUT with missing required field returns 422', async () => {
    // First create a valid entry
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/flex/products',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Temp Product', price: 1.00 },
    })
    const id = (createRes.json() as { id: string }).id

    const res = await app.inject({
      method: 'PUT',
      url: `/api/flex/products/${id}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { description: 'invalid update' },
    })
    expect(res.statusCode).toBe(422)

    // cleanup
    await app.inject({
      method: 'DELETE',
      url: `/api/flex/products/${id}`,
      headers: { authorization: `Bearer ${authToken}` },
    })
  })
})

describe('Unknown type returns 404', () => {
  it('GET /api/flex/:type with unknown type returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/flex/nonexistent',
      headers: { authorization: `Bearer ${authToken}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/flex/:type with unknown type returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/flex/nonexistent',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'test' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('Public flex type', () => {
  it('GET /api/flex/:type (public) returns entries without auth', async () => {
    // Create an entry first
    await app.inject({
      method: 'POST',
      url: '/api/flex/testimonials',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { author: 'Alice', quote: 'Great product!' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/flex/testimonials',
    })
    expect(res.statusCode).toBe(200)
    const entries = res.json() as { id: string }[]
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })
})
