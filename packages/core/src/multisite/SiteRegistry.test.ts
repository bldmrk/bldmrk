import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { SiteRegistry } from './SiteRegistry.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const CONFIG_PATH = '/project/bldmrk.config.yaml'
const PROJECT_ROOT = '/project'

const VALID_CONFIG = `
sites:
  - domain: site-a.com
    aliases:
      - www.site-a.com
  - domain: site-b.com
    aliases:
      - www.site-b.com
      - beta.site-b.com
sharedPlugins: []
`

beforeEach(() => {
  vol.reset()
})

describe('SiteRegistry', () => {
  describe('load()', () => {
    it('loads valid YAML config and returns a registry', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      expect(registry.sites).toHaveLength(2)
    })

    it('rejects invalid YAML with ZodError', async () => {
      vol.fromJSON({
        [CONFIG_PATH]: `
sites:
  - noDomainField: true
`,
      })
      await expect(SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)).rejects.toThrow()
    })

    it('rejects when file does not exist', async () => {
      await expect(SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)).rejects.toThrow()
    })
  })

  describe('resolve()', () => {
    it('returns correct SiteContext for primary domain', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('site-a.com')
      expect(ctx).not.toBeNull()
      expect(ctx!.domain).toBe('site-a.com')
      expect(ctx!.id).toBe('site-a.com')
    })

    it('normalizes www. aliases', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('www.site-a.com')
      expect(ctx).not.toBeNull()
      expect(ctx!.domain).toBe('site-a.com')
    })

    it('strips port numbers from host', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('site-a.com:3000')
      expect(ctx).not.toBeNull()
      expect(ctx!.domain).toBe('site-a.com')
    })

    it('returns null for unknown domain', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('unknown.com')
      expect(ctx).toBeNull()
    })

    it('is case-insensitive', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('SITE-A.COM')
      expect(ctx).not.toBeNull()
      expect(ctx!.domain).toBe('site-a.com')
    })

    it('resolves multi-alias site correctly', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('beta.site-b.com')
      expect(ctx).not.toBeNull()
      expect(ctx!.domain).toBe('site-b.com')
    })
  })

  describe('sites getter', () => {
    it('returns all registered sites', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const sites = registry.sites
      expect(sites).toHaveLength(2)
      expect(sites.map(s => s.domain)).toContain('site-a.com')
      expect(sites.map(s => s.domain)).toContain('site-b.com')
    })

    it('returns a copy (mutations do not affect registry)', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const sites = registry.sites
      sites.push({ id: 'extra', domain: 'extra.com', aliases: [], contentDir: '/x', configDir: '/x' })
      expect(registry.sites).toHaveLength(2)
    })
  })

  describe('contentDir / configDir resolution', () => {
    it('uses default sites/{domain} when contentDir not specified', async () => {
      vol.fromJSON({ [CONFIG_PATH]: VALID_CONFIG })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('site-a.com')!
      expect(ctx.configDir).toBe('/project/sites/site-a.com')
      expect(ctx.contentDir).toBe('/project/sites/site-a.com/content')
    })

    it('uses custom contentDir when specified', async () => {
      vol.fromJSON({
        [CONFIG_PATH]: `
sites:
  - domain: custom.com
    contentDir: /custom/path
`,
      })
      const registry = await SiteRegistry.load(CONFIG_PATH, PROJECT_ROOT)
      const ctx = registry.resolve('custom.com')!
      expect(ctx.configDir).toBe('/custom/path')
      expect(ctx.contentDir).toBe('/custom/path/content')
    })
  })
})
