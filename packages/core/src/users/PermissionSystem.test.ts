import { describe, it, expect } from 'vitest'
import { PermissionSystem } from './PermissionSystem.js'
import type { User } from './types.js'

function makeUser(role: User['role']): User {
  return { id: '1', email: 'test@example.com', passwordHash: 'x', role, createdAt: '' }
}

describe('PermissionSystem', () => {
  const perms = new PermissionSystem()

  it('admin has read, write, and admin permissions', () => {
    const user = makeUser('admin')
    expect(perms.hasPermission(user, 'read')).toBe(true)
    expect(perms.hasPermission(user, 'write')).toBe(true)
    expect(perms.hasPermission(user, 'admin')).toBe(true)
  })

  it('viewer has only read permission', () => {
    const user = makeUser('viewer')
    expect(perms.hasPermission(user, 'read')).toBe(true)
    expect(perms.hasPermission(user, 'write')).toBe(false)
    expect(perms.hasPermission(user, 'admin')).toBe(false)
  })

  it('editor has read and write but not admin', () => {
    const user = makeUser('editor')
    expect(perms.hasPermission(user, 'read')).toBe(true)
    expect(perms.hasPermission(user, 'write')).toBe(true)
    expect(perms.hasPermission(user, 'admin')).toBe(false)
  })
})
