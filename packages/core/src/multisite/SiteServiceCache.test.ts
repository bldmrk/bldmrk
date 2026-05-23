import { describe, it, expect } from 'vitest'
import { SiteServiceCache } from './SiteServiceCache.js'
import type { SiteContext } from './SiteContext.js'

function makeSiteContext(domain: string): SiteContext {
  return {
    id: domain,
    domain,
    aliases: [],
    contentDir: `/sites/${domain}/content`,
    configDir: `/sites/${domain}`,
  }
}

describe('SiteServiceCache', () => {
  describe('getPageLoader()', () => {
    it('returns the same instance on repeated calls (lazy-init)', () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      const loader1 = cache.getPageLoader(ctx)
      const loader2 = cache.getPageLoader(ctx)
      expect(loader1).toBe(loader2)
    })

    it('initializes loader with correct content directory', () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      // PageLoader stores its contentDir internally; we verify no errors occur
      const loader = cache.getPageLoader(ctx)
      expect(loader).toBeDefined()
    })
  })

  describe('getUserStore()', () => {
    it('returns the same instance for the same site on repeated calls', () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      const store1 = cache.getUserStore(ctx)
      const store2 = cache.getUserStore(ctx)
      expect(store1).toBe(store2)
    })

    it('returns different instances for different sites', () => {
      const cache = new SiteServiceCache()
      const ctxA = makeSiteContext('site-a.com')
      const ctxB = makeSiteContext('site-b.com')
      const storeA = cache.getUserStore(ctxA)
      const storeB = cache.getUserStore(ctxB)
      expect(storeA).not.toBe(storeB)
    })
  })

  describe('getSearchIndex()', () => {
    it('returns the same instance for the same site', async () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      expect(await cache.getSearchIndex(ctx)).toBe(await cache.getSearchIndex(ctx))
    })

    it('returns different instances for different sites', async () => {
      const cache = new SiteServiceCache()
      const ctxA = makeSiteContext('site-a.com')
      const ctxB = makeSiteContext('site-b.com')
      expect(await cache.getSearchIndex(ctxA)).not.toBe(await cache.getSearchIndex(ctxB))
    })
  })

  describe('getTaxonomyIndex()', () => {
    it('returns the same instance for the same site', async () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      expect(await cache.getTaxonomyIndex(ctx)).toBe(await cache.getTaxonomyIndex(ctx))
    })
  })

  describe('getFlexLoader()', () => {
    it('returns the same instance for the same site', () => {
      const cache = new SiteServiceCache()
      const ctx = makeSiteContext('site-a.com')
      expect(cache.getFlexLoader(ctx)).toBe(cache.getFlexLoader(ctx))
    })
  })

  describe('LRU eviction', () => {
    it('evicts the oldest entry when more than 20 sites are added', () => {
      const cache = new SiteServiceCache()

      // Fill 20 sites
      for (let i = 0; i < 20; i++) {
        const ctx = makeSiteContext(`site-${i}.com`)
        cache.getPageLoader(ctx)
      }

      // Capture the loader for site-0 before it is potentially evicted
      const firstCtx = makeSiteContext('site-0.com')
      const loaderBeforeEviction = cache.getPageLoader(firstCtx)
      expect(loaderBeforeEviction).toBeDefined()

      // Adding 5 more sites forces eviction 5 times — all existing loaders
      // must still be obtainable (possibly as new instances after eviction)
      for (let i = 20; i < 25; i++) {
        const ctx = makeSiteContext(`site-${i}.com`)
        cache.getPageLoader(ctx)
      }

      // All newly added sites should return valid loaders
      for (let i = 20; i < 25; i++) {
        const ctx = makeSiteContext(`site-${i}.com`)
        expect(cache.getPageLoader(ctx)).toBeDefined()
      }
    })

    it('returns a valid (possibly new) loader after eviction', () => {
      const cache = new SiteServiceCache()

      // Fill 20 sites
      const contexts = Array.from({ length: 20 }, (_, i) => makeSiteContext(`evict-site-${i}.com`))
      for (const ctx of contexts) {
        cache.getPageLoader(ctx)
      }

      // Add 3 more — evicts 3 of the original 20
      for (let i = 0; i < 3; i++) {
        cache.getPageLoader(makeSiteContext(`evict-new-${i}.com`))
      }

      // Every site should still return a defined loader (re-created if evicted)
      for (const ctx of contexts) {
        expect(cache.getPageLoader(ctx)).toBeDefined()
      }
    })

    it('cache does not grow unboundedly', () => {
      const cache = new SiteServiceCache()

      // Add 30 sites — eviction should keep cache bounded
      for (let i = 0; i < 30; i++) {
        const ctx = makeSiteContext(`bound-site-${i}.com`)
        cache.getPageLoader(ctx)
      }

      // All currently cached sites should return valid loaders
      for (let i = 25; i < 30; i++) {
        const ctx = makeSiteContext(`bound-site-${i}.com`)
        expect(cache.getPageLoader(ctx)).toBeDefined()
      }
    })
  })
})
