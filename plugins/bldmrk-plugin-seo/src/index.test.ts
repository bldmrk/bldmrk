import { describe, it, expect, vi } from 'vitest'
import { createSeoPlugin } from './index.js'
import { HookSystem } from '@bldmrk/core'
import { PluginAPIImpl } from '@bldmrk/core'
import type { BldmrkHooks } from '@bldmrk/core'
import type { PageObject } from '@bldmrk/core'

function makePage(overrides: Partial<PageObject['meta']> = {}): PageObject {
  return {
    slug: 'test',
    path: '/test',
    rawContent: '',
    meta: { title: 'Test Page', template: 'default', published: true, ...overrides },
  }
}

async function runPlugin(html: string, page: PageObject, config = {}) {
  const hooks = new HookSystem<BldmrkHooks>()
  const api = new PluginAPIImpl(hooks)
  const plugin = createSeoPlugin(config)
  await plugin.setup(api)
  const ctx = { page, html }
  await hooks.emit('page:after-render', ctx)
  return ctx.html
}

describe('bldmrk-plugin-seo', () => {
  it('injects title tag', async () => {
    const result = await runPlugin('<head></head>', makePage(), { siteName: 'My Site' })
    expect(result).toContain('<title>Test Page — My Site</title>')
  })

  it('injects meta description', async () => {
    const result = await runPlugin('<head></head>', makePage({ description: 'About this page' }))
    expect(result).toContain('<meta name="description" content="About this page">')
  })

  it('uses defaultDescription when page has none', async () => {
    const result = await runPlugin('<head></head>', makePage(), { defaultDescription: 'Default desc' })
    expect(result).toContain('content="Default desc"')
  })

  it('injects OG tags', async () => {
    const result = await runPlugin('<head></head>', makePage(), { siteName: 'bldmrk' })
    expect(result).toContain('og:title')
    expect(result).toContain('og:description')
  })

  it('exports a valid BldmrkPlugin default', async () => {
    const { default: plugin } = await import('./index.js')
    expect(plugin.name).toBe('bldmrk-plugin-seo')
    expect(typeof plugin.setup).toBe('function')
  })
})
