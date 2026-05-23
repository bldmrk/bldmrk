import { describe, it, expect } from 'vitest'
import { generateSitemapXml, createSitemapPlugin } from './index.js'
import { HookSystem, PluginAPIImpl } from '@bldmrk/core'
import type { BldmrkHooks } from '@bldmrk/core'
import { mkdtemp, readFile, rm } from 'fs/promises'
import path from 'path'
import os from 'os'

describe('generateSitemapXml', () => {
  it('produces valid sitemap XML', () => {
    const xml = generateSitemapXml('https://example.com', ['home', 'about'])
    expect(xml).toContain('<?xml version="1.0"')
    expect(xml).toContain('<url><loc>https://example.com/home</loc></url>')
    expect(xml).toContain('<url><loc>https://example.com/about</loc></url>')
  })

  it('strips trailing slash from siteUrl', () => {
    const xml = generateSitemapXml('https://example.com/', ['home'])
    expect(xml).toContain('<loc>https://example.com/home</loc>')
  })

  it('handles empty slugs', () => {
    const xml = generateSitemapXml('https://example.com', [])
    expect(xml).toContain('<urlset')
  })
})

describe('bldmrk-plugin-sitemap', () => {
  it('writes sitemap.xml on build:complete', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-sitemap-test-'))
    try {
      const hooks = new HookSystem<BldmrkHooks>()
      const api = new PluginAPIImpl(hooks)
      const plugin = createSitemapPlugin({ siteUrl: 'https://mysite.com', distDir: tmpDir })
      await plugin.setup(api)
      await hooks.emit('build:complete', { duration: 100, pages: 2, errors: [] })
      const content = await readFile(path.join(tmpDir, 'sitemap.xml'), 'utf-8')
      expect(content).toContain('<urlset')
    } finally {
      await rm(tmpDir, { recursive: true })
    }
  })

  it('exports a valid BldmrkPlugin default', async () => {
    const { default: plugin } = await import('./index.js')
    expect(plugin.name).toBe('bldmrk-plugin-sitemap')
    expect(typeof plugin.setup).toBe('function')
  })
})
