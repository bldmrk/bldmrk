import type { CacheStore } from './CacheStore.js'

/**
 * No-operation cache — used when caching is disabled or in tests.
 * All operations are no-ops; get() always returns null.
 */
export class NoopCache implements CacheStore {
  async get<T>(_key: string): Promise<T | null> {
    return null
  }

  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    // no-op
  }

  async delete(_key: string): Promise<void> {
    // no-op
  }

  async deleteByPrefix(_prefix: string): Promise<void> {
    // no-op
  }

  async clear(): Promise<void> {
    // no-op
  }
}
