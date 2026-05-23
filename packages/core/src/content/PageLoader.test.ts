import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { PageLoader } from './PageLoader.js'
import { PageNotFoundError } from './errors.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const CONTENT_DIR = '/content/pages'

const HOME_MDX = `---
title: Home
---
# Welcome

This is the home page.
`

const HOME_YAML = `title: Home
template: default
published: true
`

const ABOUT_MDX = `---
title: About
---
# About

No page.yaml here.
`

beforeEach(() => {
  vol.reset()
  vol.fromJSON({
    [`${CONTENT_DIR}/001--home/index.mdx`]: HOME_MDX,
    [`${CONTENT_DIR}/001--home/page.yaml`]: HOME_YAML,
    [`${CONTENT_DIR}/003--about/index.mdx`]: ABOUT_MDX,
    [`${CONTENT_DIR}/010--page/index.mdx`]: '---\ntitle: Page\n---\n# Page\n',
  })
})

describe('PageLoader', () => {
  it('loads page meta from slug', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('home')
    expect(page.meta.title).toBe('Home')
    expect(page.meta.template).toBe('default')
  })

  it('loads rawContent from index.mdx', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('home')
    expect(page.rawContent).toContain('# Welcome')
  })

  it('sets slug and path on the page object', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('home')
    expect(page.slug).toBe('home')
    expect(page.path).toBe(`${CONTENT_DIR}/001--home`)
  })

  it('applies FrontmatterSchema defaults when no page.yaml exists', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('about')
    expect(page.meta.published).toBe(true)
    expect(page.meta.template).toBe('default')
  })

  it('throws PageNotFoundError for unknown slug', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    await expect(loader.load('nonexistent')).rejects.toThrow(PageNotFoundError)
  })

  it('returns cached result on second load without re-reading disk', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const fsSpy = vi.spyOn(
      await import('fs/promises'),
      'readFile'
    )
    await loader.load('home')
    const callsAfterFirst = fsSpy.mock.calls.length
    await loader.load('home')
    expect(fsSpy.mock.calls.length).toBe(callsAfterFirst)
  })

  it('re-reads disk after invalidate', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const fsSpy = vi.spyOn(
      await import('fs/promises'),
      'readFile'
    )
    await loader.load('home')
    const callsAfterFirst = fsSpy.mock.calls.length
    loader.invalidate('home')
    await loader.load('home')
    expect(fsSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('extracts slug from NNN--slug folder name', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('about')
    expect(page.slug).toBe('about')
  })

  it('handles leading zeros in numeric prefix', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const page = await loader.load('page')
    expect(page.slug).toBe('page')
  })

  it('loadAll returns all pages as flat array', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const pages = await loader.loadAll()
    expect(pages).toHaveLength(3)
    const slugs = pages.map(p => p.slug).sort()
    expect(slugs).toEqual(['about', 'home', 'page'])
  })

  it('invalidateAll clears all cached entries', async () => {
    const loader = new PageLoader(CONTENT_DIR)
    const fsSpy = vi.spyOn(
      await import('fs/promises'),
      'readFile'
    )
    await loader.load('home')
    await loader.load('about')
    const callsAfterLoads = fsSpy.mock.calls.length
    loader.invalidateAll()
    await loader.load('home')
    expect(fsSpy.mock.calls.length).toBeGreaterThan(callsAfterLoads)
  })
})
