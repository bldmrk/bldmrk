import { describe, it, expect, beforeAll, vi } from 'vitest'
import { vol } from 'memfs'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

import { BlueprintEngine } from './BlueprintEngine.js'

const CORE_DEFAULT = `
name: default
label: Default Page
tabs:
  - id: content
    label: Content
    fields:
      - name: _content
        type: markdown
        label: Content
  - id: meta
    label: Metadata
    fields:
      - name: title
        type: text
        label: Title
        required: true
`.trim()

const CORE_BLOG = `
name: blog
label: Blog Post
extends: default
tabs:
  - id: content
    label: Content
    fields:
      - name: _content
        type: markdown
        label: Post Content
  - id: meta
    label: Metadata
    fields:
      - name: title
        type: text
        label: Title
        required: true
      - name: tags
        type: tags
        label: Tags
`.trim()

const USER_OVERRIDE = `
name: default
label: Custom Default Page
tabs:
  - id: content
    label: Content
    fields:
      - name: _content
        type: markdown
        label: Content
  - id: meta
    label: Metadata
    fields:
      - name: title
        type: text
        label: Title
        required: true
      - name: custom_field
        type: text
        label: Custom Field
`.trim()

const CORE_PARTIAL_OVERRIDE = `
name: partial-override
label: Partial Override
extends: default
tabs:
  - id: content
    label: Content Override
    fields:
      - name: _content
        type: markdown
        label: Custom Content
`.trim()

const CORE_SITE_CONFIG = `
name: site
label: Site Settings
tabs:
  - id: general
    label: General
    fields:
      - name: name
        type: text
        label: Site Name
        required: true
`.trim()

beforeAll(() => {
  vol.fromJSON({
    '/core/blueprints/pages/default.yaml': CORE_DEFAULT,
    '/core/blueprints/pages/blog.yaml': CORE_BLOG,
    '/core/blueprints/pages/partial-override.yaml': CORE_PARTIAL_OVERRIDE,
    '/core/blueprints/config/site.yaml': CORE_SITE_CONFIG,
    '/user/blueprints/pages/default.yaml': USER_OVERRIDE,
  })
})

describe('BlueprintEngine', () => {
  describe('resolve() without user dir', () => {
    it('loads a core blueprint', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      const bp = await engine.resolve('pages', 'default')
      expect(bp.name).toBe('default')
      expect(bp.label).toBe('Default Page')
      expect(bp.tabs).toHaveLength(2)
    })

    it('resolves extends by merging parent tabs', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      const bp = await engine.resolve('pages', 'blog')
      expect(bp.name).toBe('blog')
      expect(bp.tabs?.find(t => t.id === 'meta')?.fields.some(f => f.name === 'tags')).toBe(true)
    })

    it('preserves parent tabs not overridden by child extends', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      const bp = await engine.resolve('pages', 'partial-override')
      // content tab should come from child
      const contentTab = bp.tabs?.find(t => t.id === 'content')
      expect(contentTab?.label).toBe('Content Override')
      // meta tab should be preserved from parent (default)
      const metaTab = bp.tabs?.find(t => t.id === 'meta')
      expect(metaTab).toBeDefined()
      expect(metaTab?.fields.some(f => f.name === 'title')).toBe(true)
    })

    it('throws for unknown blueprint', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      await expect(engine.resolve('pages', 'nonexistent')).rejects.toThrow('Blueprint not found')
    })
  })

  describe('resolve() with user dir', () => {
    it('returns user override when present', async () => {
      const engine = new BlueprintEngine('/core/blueprints', '/user/blueprints')
      const bp = await engine.resolve('pages', 'default')
      expect(bp.label).toBe('Custom Default Page')
      expect(bp.tabs?.find(t => t.id === 'meta')?.fields.some(f => f.name === 'custom_field')).toBe(true)
    })

    it('falls back to core when no user override', async () => {
      const engine = new BlueprintEngine('/core/blueprints', '/user/blueprints')
      const bp = await engine.resolve('pages', 'blog')
      expect(bp.label).toBe('Blog Post')
    })
  })

  describe('list()', () => {
    it('lists available blueprint names for pages scope', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      const names = await engine.list('pages')
      expect(names).toContain('default')
      expect(names).toContain('blog')
    })

    it('lists available blueprint names for config scope', async () => {
      const engine = new BlueprintEngine('/core/blueprints')
      const names = await engine.list('config')
      expect(names).toContain('site')
    })
  })
})
