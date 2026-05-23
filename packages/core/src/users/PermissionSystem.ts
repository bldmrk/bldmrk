import type { UserRole } from './types.js'

type Action = 'read' | 'write' | 'admin'

const PERMISSIONS: Record<UserRole, ReadonlySet<Action>> = {
  admin: new Set(['read', 'write', 'admin']),
  editor: new Set(['read', 'write']),
  viewer: new Set(['read']),
}

export class PermissionSystem {
  hasPermission(user: { role: UserRole }, action: Action): boolean {
    return PERMISSIONS[user.role].has(action)
  }
}
