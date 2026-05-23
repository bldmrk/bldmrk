import type { CacheStore } from './CacheStore.js'

interface CacheEntry<T> {
  value: T
  expiresAt: number | null // ms timestamp, or null for no expiry
}

interface MemoryCacheOptions {
  ttl?: number    // default TTL in seconds; undefined = no expiry
  maxSize?: number // max number of entries; undefined = unlimited
}

export class MemoryCache implements CacheStore {
  // Use insertion-order Map for LRU tracking (move-to-end on access)
  private store: Map<string, CacheEntry<unknown>> = new Map()
  private readonly defaultTtl: number | undefined
  private readonly maxSize: number | undefined

  constructor(options: MemoryCacheOptions) {
    this.defaultTtl = options.ttl
    this.maxSize = options.maxSize
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.store.delete(key)
    this.store.set(key, entry)

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    // Evict existing entry if present (to re-insert at end)
    if (this.store.has(key)) {
      this.store.delete(key)
    }

    // LRU eviction: remove least recently used (first in Map) when at capacity
    if (this.maxSize !== undefined && this.store.size >= this.maxSize) {
      const lruKey = this.store.keys().next().value
      if (lruKey !== undefined) {
        this.store.delete(lruKey)
      }
    }

    const effectiveTtl = ttlSeconds ?? this.defaultTtl
    const expiresAt = effectiveTtl !== undefined ? Date.now() + effectiveTtl * 1_000 : null

    this.store.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const toDelete: string[] = []
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        toDelete.push(key)
      }
    }
    for (const key of toDelete) {
      this.store.delete(key)
    }
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  /** Returns the current number of entries (including potentially expired ones). */
  get size(): number {
    return this.store.size
  }
}
