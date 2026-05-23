import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ioredis before importing RedisCache
const mockClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
  flushdb: vi.fn(),
  quit: vi.fn(),
}

vi.mock('ioredis', () => {
  return {
    Redis: vi.fn(() => mockClient),
  }
})

import { RedisCache } from './RedisCache.js'

const defaultConfig = { host: 'localhost', port: 6379 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RedisCache', () => {
  describe('set()', () => {
    it('calls setex with serialized value and TTL when ttlSeconds > 0', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.setex.mockResolvedValue('OK')

      await cache.set('mykey', { foo: 'bar' }, 30)

      expect(mockClient.setex).toHaveBeenCalledWith('mykey', 30, JSON.stringify({ foo: 'bar' }))
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('calls set (not setex) when no TTL is provided', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.set.mockResolvedValue('OK')

      await cache.set('mykey', { foo: 'bar' })

      expect(mockClient.set).toHaveBeenCalledWith('mykey', JSON.stringify({ foo: 'bar' }))
      expect(mockClient.setex).not.toHaveBeenCalled()
    })

    it('calls set (not setex) when ttlSeconds is 0', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.set.mockResolvedValue('OK')

      await cache.set('mykey', 'value', 0)

      expect(mockClient.set).toHaveBeenCalled()
      expect(mockClient.setex).not.toHaveBeenCalled()
    })
  })

  describe('get()', () => {
    it('deserializes and returns the JSON value on cache hit', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.get.mockResolvedValue(JSON.stringify({ hello: 'world' }))

      const result = await cache.get<{ hello: string }>('mykey')

      expect(mockClient.get).toHaveBeenCalledWith('mykey')
      expect(result).toEqual({ hello: 'world' })
    })

    it('returns null on cache miss (null from Redis)', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.get.mockResolvedValue(null)

      const result = await cache.get('missing')

      expect(result).toBeNull()
    })

    it('returns null when stored value is invalid JSON', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.get.mockResolvedValue('not-valid-json{{{')

      const result = await cache.get('corrupt')

      expect(result).toBeNull()
    })
  })

  describe('delete()', () => {
    it('calls del with the given key', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.del.mockResolvedValue(1)

      await cache.delete('somekey')

      expect(mockClient.del).toHaveBeenCalledWith('somekey')
    })
  })

  describe('deleteByPrefix()', () => {
    it('runs SCAN loop and calls del on found keys with prefix stripped', async () => {
      const cache = new RedisCache(defaultConfig)
      // First SCAN returns cursor '42' with two keys, second returns '0' (done)
      mockClient.scan
        .mockResolvedValueOnce(['42', ['bldmrk:pages:all', 'bldmrk:pages:home']])
        .mockResolvedValueOnce(['0', []])
      mockClient.del.mockResolvedValue(2)

      await cache.deleteByPrefix('pages:')

      expect(mockClient.scan).toHaveBeenCalledTimes(2)
      // Keys should have 'bldmrk:' prefix stripped before passing to del
      expect(mockClient.del).toHaveBeenCalledWith('pages:all', 'pages:home')
    })

    it('does not call del when SCAN returns no keys', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.scan.mockResolvedValueOnce(['0', []])

      await cache.deleteByPrefix('empty:')

      expect(mockClient.del).not.toHaveBeenCalled()
    })
  })

  describe('clear()', () => {
    it('calls flushdb', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.flushdb.mockResolvedValue('OK')

      await cache.clear()

      expect(mockClient.flushdb).toHaveBeenCalledOnce()
    })
  })

  describe('constructor', () => {
    it('uses default keyPrefix "bldmrk:" when none provided', async () => {
      const { Redis } = await import('ioredis')
      new RedisCache({ host: 'localhost', port: 6379 })
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'bldmrk:' }),
      )
    })

    it('uses custom keyPrefix from config', async () => {
      const { Redis } = await import('ioredis')
      new RedisCache({ host: 'localhost', port: 6379, keyPrefix: 'myapp:' })
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'myapp:' }),
      )
    })
  })

  describe('quit()', () => {
    it('calls quit on the Redis client', async () => {
      const cache = new RedisCache(defaultConfig)
      mockClient.quit.mockResolvedValue('OK')

      await cache.quit()

      expect(mockClient.quit).toHaveBeenCalledOnce()
    })
  })
})
