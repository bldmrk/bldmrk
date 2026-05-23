import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { UserStore } from './UserStore.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const USERS_FILE = '/config/users.yaml'

beforeEach(() => {
  vol.reset()
  vol.fromJSON({ '/config/.keep': '' })
})

describe('UserStore', () => {
  it('returns undefined for unknown email', async () => {
    const store = new UserStore(USERS_FILE)
    expect(await store.findByEmail('nobody@example.com')).toBeUndefined()
  })

  it('create stores user and findByEmail retrieves it', async () => {
    const store = new UserStore(USERS_FILE)
    const user = await store.create({ email: 'bob@example.com', password: 'secret12', role: 'editor' })
    expect(user.id).toBeTruthy()
    expect(user.email).toBe('bob@example.com')
    expect(user.role).toBe('editor')
    expect(user.passwordHash).not.toBe('secret12')

    const found = await store.findByEmail('bob@example.com')
    expect(found?.id).toBe(user.id)
  })

  it('create persists to YAML — data survives a new store instance', async () => {
    const store1 = new UserStore(USERS_FILE)
    const user = await store1.create({ email: 'alice@example.com', password: 'password1', role: 'admin' })

    const store2 = new UserStore(USERS_FILE)
    const found = await store2.findByEmail('alice@example.com')
    expect(found?.id).toBe(user.id)
  })

  it('throws when password is shorter than 8 characters', async () => {
    const store = new UserStore(USERS_FILE)
    await expect(store.create({ email: 'x@y.com', password: 'short', role: 'editor' }))
      .rejects.toThrow('8 characters')
  })

  it('update changes allowed fields', async () => {
    const store = new UserStore(USERS_FILE)
    const user = await store.create({ email: 'carol@example.com', password: 'password1', role: 'viewer' })
    const updated = await store.update(user.id, { role: 'editor' })
    expect(updated.role).toBe('editor')
    expect(updated.email).toBe('carol@example.com')
  })

  it('update throws for unknown id', async () => {
    const store = new UserStore(USERS_FILE)
    await expect(store.update('nonexistent-id', { role: 'admin' })).rejects.toThrow('User not found')
  })

  it('update hashes new password when provided', async () => {
    const store = new UserStore(USERS_FILE)
    const user = await store.create({ email: 'eve@example.com', password: 'password1', role: 'viewer' })
    const updated = await store.update(user.id, { password: 'newpassword' })
    expect(updated.passwordHash).not.toBe(user.passwordHash)
    expect(await store.verifyPassword(updated, 'newpassword')).toBe(true)
  })

  it('update throws when new password is shorter than 8 characters', async () => {
    const store = new UserStore(USERS_FILE)
    const user = await store.create({ email: 'frank@example.com', password: 'password1', role: 'viewer' })
    await expect(store.update(user.id, { password: 'short' })).rejects.toThrow('8 characters')
  })

  it('verifyPassword returns true for correct password', async () => {
    const store = new UserStore(USERS_FILE)
    const user = await store.create({ email: 'dan@example.com', password: 'correct1', role: 'viewer' })
    expect(await store.verifyPassword(user, 'correct1')).toBe(true)
    expect(await store.verifyPassword(user, 'wrong')).toBe(false)
  })

  describe('list', () => {
    it('returns all users', async () => {
      const store = new UserStore(USERS_FILE)
      await store.create({ email: 'a@test.com', password: 'password1', role: 'editor' })
      await store.create({ email: 'b@test.com', password: 'password2', role: 'viewer' })
      const users = await store.list()
      expect(users.map(u => u.email)).toContain('a@test.com')
      expect(users.map(u => u.email)).toContain('b@test.com')
    })

    it('returns empty array when no users exist', async () => {
      const store = new UserStore(USERS_FILE)
      const users = await store.list()
      expect(users).toEqual([])
    })
  })

  describe('delete', () => {
    it('removes user by id', async () => {
      const store = new UserStore(USERS_FILE)
      const user = await store.create({ email: 'del@test.com', password: 'password1', role: 'viewer' })
      await store.delete(user.id)
      expect(await store.findByEmail('del@test.com')).toBeUndefined()
    })

    it('throws when user id not found', async () => {
      const store = new UserStore(USERS_FILE)
      await expect(store.delete('nonexistent-id')).rejects.toThrow('User not found')
    })
  })
})
