import { Redis } from 'ioredis'
import type { CacheStore } from './CacheStore.js'

export interface RedisCacheConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
}

/**
 * Redis-backed cache using ioredis v5.
 */
export class RedisCache implements CacheStore {
  private readonly client: Redis
  private readonly keyPrefix: string

  constructor(config: RedisCacheConfig) {
    this.keyPrefix = config.keyPrefix ?? 'bldmrk:'
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db ?? 0,
      keyPrefix: this.keyPrefix,
      lazyConnect: true,
    })
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.client.setex(key, ttlSeconds, serialized)
    } else {
      await this.client.set(key, serialized)
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key)
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const pattern = `${this.keyPrefix}${prefix}*`

    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        // ioredis prepends keyPrefix to keys in commands, but SCAN returns raw Redis keys.
        // Strip keyPrefix so del() can re-prepend it correctly.
        const strippedKeys = keys.map((k: string) =>
          k.startsWith(this.keyPrefix) ? k.slice(this.keyPrefix.length) : k,
        )
        await this.client.del(...strippedKeys)
      }
    } while (cursor !== '0')
  }

  async clear(): Promise<void> {
    await this.client.flushdb()
  }

  async quit(): Promise<void> {
    await this.client.quit()
  }
}
