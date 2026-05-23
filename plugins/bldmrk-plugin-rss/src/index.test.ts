import { describe, it, expect } from 'vitest'
import { generateRssXml, createRssPlugin } from './index.js'
import { HookSystem, PluginAPIImpl } from '@bldmrk/core'
import type { BldmrkHooks, PageObject } from '@bldmrk/core'
import { mkdtemp, readFile, rm } from 'fs/promises'
import path from 'path'
import os from 'os'

function makePage(slug: string, title: string, date: string, published = true): PageObject {
  return { slug, path: `/${slug}`, rawContent: '', meta: { title, date: new Date(date), published, template: 'default' } }
}

describe('generateRssXml', () => {
  it('includes published pages with dates', () => {
    const pages = [makePage('post-1', 'First Post', '2024-01-01')]
    const xml = generateRssXml({ siteUrl: 'https://example.com', title: 'My Blog' }, pages)
    expect(xml).toContain('<title>First Post</title>')
    expect(xml).toContain('<link>https://example.com/post-1</link>')
  })

  it('sorts by date descending', () => {
    const pages = [
      makePage('old', 'Old', '2023-01-01'),
      makePage('new', 'New', '2024-01-01'),
    ]
    const xml = generateRssXml({ siteUrl: 'https://example.com', title: 'Blog' }, pages)
    expect(xml.indexOf('New')).toBeLessThan(xml.indexOf('Old'))
  })

  it('excludes unpublished pages', () => {
    const pages = [makePage('draft', 'Draft', '2024-01-01', false)]
    const xml = generateRssXml({ siteUrl: 'https://example.com', title: 'Blog' }, pages)
    expect(xml).not.toContain('Draft')
  })

  it('respects maxItems', () => {
    const pages = Array.from({ length: 5 }, (_, i) => makePage(`post-${i}`, `Post ${i}`, `2024-01-0${i + 1}`))
    const xml = generateRssXml({ siteUrl: 'https://example.com', title: 'Blog', maxItems: 2 }, pages)
    expect((xml.match(/<item>/g) ?? []).length).toBe(2)
  })
})

describe('bldmrk-plugin-rss', () => {
  it('writes feed.xml after build:complete with indexed pages', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-rss-test-'))
    try {
      const hooks = new HookSystem<BldmrkHooks>()
      const api = new PluginAPIImpl(hooks)
      const plugin = createRssPlugin({ siteUrl: 'https://mysite.com', title: 'My Blog', distDir: tmpDir })
      await plugin.setup(api)
      const pages = [makePage('post-1', 'Hello', '2024-06-01')]
      await hooks.emit('search:index', { pages })
      await hooks.emit('build:complete', { duration: 100, pages: 1, errors: [] })
      const content = await readFile(path.join(tmpDir, 'feed.xml'), 'utf-8')
      expect(content).toContain('<title>Hello</title>')
    } finally {
      await rm(tmpDir, { recursive: true })
    }
  })

  it('exports a valid BldmrkPlugin default', async () => {
    const { default: plugin } = await import('./index.js')
    expect(plugin.name).toBe('bldmrk-plugin-rss')
    expect(typeof plugin.setup).toBe('function')
  })
})
