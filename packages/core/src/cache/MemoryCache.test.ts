import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MemoryCache } from './MemoryCache.js'

describe('MemoryCache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('set and get returns the stored value', async () => {
    const cache = new MemoryCache({})
    await cache.set('key1', { hello: 'world' })
    const result = await cache.get<{ hello: string }>('key1')
    expect(result).toEqual({ hello: 'world' })
  })

  it('get returns null for missing key', async () => {
    const cache = new MemoryCache({})
    const result = await cache.get('nonexistent')
    expect(result).toBeNull()
  })

  it('TTL expired — get returns null', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 10 })
    await cache.set('expiring', 'value', 10)
    // advance 11 seconds
    vi.advanceTimersByTime(11_000)
    const result = await cache.get('expiring')
    expect(result).toBeNull()
  })

  it('TTL not yet expired — get returns value', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 60 })
    await cache.set('fresh', 'still-here', 60)
    vi.advanceTimersByTime(30_000)
    const result = await cache.get('fresh')
    expect(result).toBe('still-here')
  })

  it('delete removes a key', async () => {
    const cache = new MemoryCache({})
    await cache.set('to-delete', 42)
    await cache.delete('to-delete')
    expect(await cache.get('to-delete')).toBeNull()
  })

  it('deleteByPrefix removes all matching keys and leaves others', async () => {
    const cache = new MemoryCache({})
    await cache.set('pages:all', [1, 2, 3])
    await cache.set('pages:home', { slug: 'home' })
    await cache.set('taxonomy:tags', ['a', 'b'])

    await cache.deleteByPrefix('pages:')

    expect(await cache.get('pages:all')).toBeNull()
    expect(await cache.get('pages:home')).toBeNull()
    expect(await cache.get('taxonomy:tags')).toEqual(['a', 'b'])
  })

  it('clear removes all keys', async () => {
    const cache = new MemoryCache({})
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.clear()
    expect(await cache.get('a')).toBeNull()
    expect(await cache.get('b')).toBeNull()
  })

  it('LRU eviction when maxSize exceeded', async () => {
    const cache = new MemoryCache({ maxSize: 3 })
    await cache.set('first', 1)
    await cache.set('second', 2)
    await cache.set('third', 3)
    // Access 'first' to make it recently used
    await cache.get('first')
    // Adding a 4th item should evict LRU ('second')
    await cache.set('fourth', 4)

    expect(await cache.get('fourth')).toBe(4)
    expect(await cache.get('first')).toBe(1)
    expect(await cache.get('third')).toBe(3)
    // 'second' was LRU when 'fourth' was inserted
    expect(await cache.get('second')).toBeNull()
  })

  it('default TTL from constructor applies when no per-call TTL', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 5 })
    await cache.set('key', 'value')
    vi.advanceTimersByTime(6_000)
    expect(await cache.get('key')).toBeNull()
  })

  it('per-call TTL overrides constructor default', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({ ttl: 60 })
    await cache.set('short', 'value', 2)
    vi.advanceTimersByTime(3_000)
    expect(await cache.get('short')).toBeNull()
  })

  it('no TTL — value lives forever', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache({})
    await cache.set('persistent', 'forever')
    vi.advanceTimersByTime(1_000_000_000)
    expect(await cache.get('persistent')).toBe('forever')
  })
})
