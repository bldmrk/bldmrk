import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { SignJWT } from 'jose'
import { AuthService } from './AuthService.js'
import { UserStore } from './UserStore.js'
import { AuthError, TokenExpiredError, TokenTypeError } from './errors.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const USERS_FILE = '/config/users.yaml'
const JWT_SECRET = 'test-secret-key-that-is-long-enough'

function makeStore(): UserStore {
  return new UserStore(USERS_FILE)
}

function makeService(store: UserStore): AuthService {
  return new AuthService(store, JWT_SECRET)
}

beforeEach(() => {
  vol.reset()
  vol.fromJSON({ '/config/.keep': '' })
})

describe('AuthService', () => {
  it('login with correct credentials returns access and refresh tokens', async () => {
    const store = makeStore()
    await store.create({ email: 'alice@example.com', password: 'correct-pass', role: 'editor' })

    const service = makeService(store)
    const { accessToken, refreshToken } = await service.login('alice@example.com', 'correct-pass')

    expect(typeof accessToken).toBe('string')
    expect(typeof refreshToken).toBe('string')
    expect(accessToken).not.toBe(refreshToken)
  })

  it('login with wrong password throws AuthError', async () => {
    const store = makeStore()
    await store.create({ email: 'alice@example.com', password: 'correct-pass', role: 'editor' })

    const service = makeService(store)
    await expect(service.login('alice@example.com', 'wrong-pass')).rejects.toThrow(AuthError)
  })

  it('login with unknown email throws AuthError', async () => {
    const store = makeStore()
    const service = makeService(store)
    await expect(service.login('nobody@example.com', 'pass')).rejects.toThrow(AuthError)
  })

  it('verifyToken with valid access token returns payload', async () => {
    const store = makeStore()
    await store.create({ email: 'alice@example.com', password: 'password1', role: 'admin' })

    const service = makeService(store)
    const { accessToken } = await service.login('alice@example.com', 'password1')
    const payload = await service.verifyToken(accessToken)

    expect(payload.email).toBe('alice@example.com')
    expect(payload.role).toBe('admin')
    expect(payload.typ).toBe('access')
  })

  it('verifyToken with expired token throws TokenExpiredError', async () => {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const expiredToken = await new SignJWT({ sub: 'u1', email: 'x@x.com', role: 'viewer', typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(new Date(Date.now() - 3600_000))
      .setExpirationTime(new Date(Date.now() - 1800_000))
      .sign(secret)

    const store = makeStore()
    const service = makeService(store)
    await expect(service.verifyToken(expiredToken)).rejects.toThrow(TokenExpiredError)
  })

  it('refreshToken with valid refresh token returns new access token', async () => {
    const store = makeStore()
    await store.create({ email: 'alice@example.com', password: 'password1', role: 'viewer' })

    const service = makeService(store)
    const { refreshToken } = await service.login('alice@example.com', 'password1')
    const { accessToken } = await service.refreshToken(refreshToken)

    expect(typeof accessToken).toBe('string')
    const payload = await service.verifyToken(accessToken)
    expect(payload.typ).toBe('access')
    expect(payload.email).toBe('alice@example.com')
  })

  it('refreshToken with access token throws TokenTypeError', async () => {
    const store = makeStore()
    await store.create({ email: 'alice@example.com', password: 'password1', role: 'editor' })

    const service = makeService(store)
    const { accessToken } = await service.login('alice@example.com', 'password1')
    await expect(service.refreshToken(accessToken)).rejects.toThrow(TokenTypeError)
  })
})
