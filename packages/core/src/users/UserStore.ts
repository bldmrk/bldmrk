import { readFile, writeFile } from 'fs/promises'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'
import { hash as argon2Hash, verify as argon2Verify } from 'argon2'
import { randomUUID } from 'crypto'
import type { User, NewUser } from './types.js'

export class UserStore {
  constructor(private readonly filePath: string) {}

  private async readUsers(): Promise<User[]> {
    try {
      const content = await readFile(this.filePath, 'utf-8')
      return (parseYaml(content) as User[]) ?? []
    } catch {
      return []
    }
  }

  private async writeUsers(users: User[]): Promise<void> {
    await writeFile(this.filePath, dumpYaml(users), 'utf-8')
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const users = await this.readUsers()
    return users.find(u => u.email === email)
  }

  async create(newUser: NewUser): Promise<User> {
    if (!newUser.password || newUser.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }
    const users = await this.readUsers()
    const user: User = {
      id: randomUUID(),
      email: newUser.email,
      passwordHash: await argon2Hash(newUser.password),
      role: newUser.role,
      createdAt: new Date().toISOString(),
    }
    users.push(user)
    await this.writeUsers(users)
    return user
  }

  async update(id: string, data: Partial<Omit<User, 'passwordHash'>> & { password?: string }): Promise<User> {
    if (data.password !== undefined && data.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }
    const users = await this.readUsers()
    const index = users.findIndex(u => u.id === id)
    if (index === -1) throw new Error(`User not found: ${id}`)
    if (data.password) {
      const { password: _pw, ...safeData } = data
      users[index] = { ...users[index]!, ...safeData, passwordHash: await argon2Hash(data.password) }
    } else {
      const { password: _pw, ...safeData } = data
      users[index] = { ...users[index]!, ...safeData }
    }
    await this.writeUsers(users)
    return users[index]!
  }

  async list(): Promise<User[]> {
    return this.readUsers()
  }

  async delete(id: string): Promise<void> {
    const users = await this.readUsers()
    const index = users.findIndex(u => u.id === id)
    if (index === -1) throw new Error(`User not found: ${id}`)
    users.splice(index, 1)
    await this.writeUsers(users)
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return argon2Verify(user.passwordHash, password)
  }
}
