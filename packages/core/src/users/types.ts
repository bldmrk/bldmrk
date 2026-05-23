export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

export interface NewUser {
  email: string
  password: string
  role: UserRole
}

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  typ: 'access' | 'refresh'
}
