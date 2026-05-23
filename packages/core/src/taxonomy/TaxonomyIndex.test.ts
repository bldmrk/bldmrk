import { describe, it, expect, beforeEach } from 'vitest'
import { TaxonomyIndex } from './TaxonomyIndex.js'
import type { PageObject } from '../content/types.js'

function makePage(overrides: {
  slug: string
  published?: boolean
  tags?: string[]
  author?: string
  title?: string
}): PageObject {
  return {
    slug: overrides.slug,
    path: `/content/pages/${overrides.slug}`,
    rawContent: `Content for ${overrides.slug}`,
    meta: {
      title: overrides.title ?? `Page ${overrides.slug}`,
      published: overrides.published ?? true,
      template: 'default',
      tags: overrides.tags,
      author: overrides.author,
    },
  }
}

describe('TaxonomyIndex', () => {
  let index: TaxonomyIndex

  beforeEach(() => {
    index = new TaxonomyIndex()
  })

  it('rebuild([]) results in getTags() returning []', () => {
    index.rebuild([])
    expect(index.getTags()).toEqual([])
  })

  it('rebuild([]) results in getAuthors() returning []', () => {
    index.rebuild([])
    expect(index.getAuthors()).toEqual([])
  })

  it('aggregates tags from 3 pages and returns correct counts sorted desc', () => {
    const pages = [
      makePage({ slug: 'a', tags: ['vue', 'javascript'] }),
      makePage({ slug: 'b', tags: ['vue', 'typescript'] }),
      makePage({ slug: 'c', tags: ['vue'] }),
    ]
    index.rebuild(pages)

    const tags = index.getTags()
    const vueEntry = tags.find(t => t.value === 'vue')
    expect(vueEntry).toBeDefined()
    expect(vueEntry!.count).toBe(3)

    const jsEntry = tags.find(t => t.value === 'javascript')
    expect(jsEntry!.count).toBe(1)

    // Sorted by count desc
    expect(tags[0]!.value).toBe('vue')
  })

  it('does not index pages with published: false', () => {
    const pages = [
      makePage({ slug: 'draft', tags: ['secret'], published: false }),
      makePage({ slug: 'public', tags: ['public-tag'], published: true }),
    ]
    index.rebuild(pages)

    const tags = index.getTags()
    expect(tags.every(t => t.value !== 'secret')).toBe(true)
    expect(tags.some(t => t.value === 'public-tag')).toBe(true)
  })

  it('getPagesByTag returns only pages with that tag', () => {
    const pages = [
      makePage({ slug: 'vue-page', tags: ['vue'] }),
      makePage({ slug: 'js-page', tags: ['javascript'] }),
      makePage({ slug: 'both', tags: ['vue', 'javascript'] }),
    ]
    index.rebuild(pages)

    const vuePages = index.getPagesByTag('vue')
    expect(vuePages).toHaveLength(2)
    expect(vuePages.every(p => p.meta.tags?.includes('vue'))).toBe(true)

    const jsPages = index.getPagesByTag('javascript')
    expect(jsPages).toHaveLength(2)
  })

  it('getPagesByTag returns [] for unknown tag', () => {
    index.rebuild([])
    expect(index.getPagesByTag('nonexistent')).toEqual([])
  })

  it('getTagsForPage returns tags for a given slug', () => {
    const pages = [
      makePage({ slug: 'my-page', tags: ['vue', 'typescript'] }),
    ]
    index.rebuild(pages)

    expect(index.getTagsForPage('my-page')).toEqual(['vue', 'typescript'])
  })

  it('getTagsForPage returns [] for unknown slug', () => {
    index.rebuild([])
    expect(index.getTagsForPage('unknown')).toEqual([])
  })

  it('aggregates authors correctly', () => {
    const pages = [
      makePage({ slug: 'a', author: 'Alice' }),
      makePage({ slug: 'b', author: 'Alice' }),
      makePage({ slug: 'c', author: 'Bob' }),
    ]
    index.rebuild(pages)

    const authors = index.getAuthors()
    const alice = authors.find(a => a.value === 'Alice')
    expect(alice).toBeDefined()
    expect(alice!.count).toBe(2)

    const bob = authors.find(a => a.value === 'Bob')
    expect(bob!.count).toBe(1)

    expect(authors[0]!.value).toBe('Alice')
  })

  it('getPagesByAuthor returns pages for that author', () => {
    const pages = [
      makePage({ slug: 'a', author: 'Alice' }),
      makePage({ slug: 'b', author: 'Bob' }),
    ]
    index.rebuild(pages)

    const alicePages = index.getPagesByAuthor('Alice')
    expect(alicePages).toHaveLength(1)
    expect(alicePages[0]!.slug).toBe('a')
  })

  it('tag slugs are URL-safe: spaces become hyphens, special chars removed, lowercase', () => {
    const pages = [
      makePage({ slug: 'p1', tags: ['Vue.js'] }),
      makePage({ slug: 'p2', tags: ['C++ Programming'] }),
    ]
    index.rebuild(pages)

    const tags = index.getTags()
    const vueEntry = tags.find(t => t.value === 'Vue.js')
    expect(vueEntry!.slug).toBe('vuejs')

    const cppEntry = tags.find(t => t.value === 'C++ Programming')
    expect(cppEntry!.slug).toBe('c-programming')
  })

  it('spaces in tag values become hyphens in slug', () => {
    const pages = [
      makePage({ slug: 'p1', tags: ['web development'] }),
    ]
    index.rebuild(pages)

    const tags = index.getTags()
    expect(tags[0]!.slug).toBe('web-development')
  })

  it('rebuild clears previous state', () => {
    index.rebuild([makePage({ slug: 'a', tags: ['old-tag'] })])
    expect(index.getTags().some(t => t.value === 'old-tag')).toBe(true)

    index.rebuild([])
    expect(index.getTags()).toEqual([])
  })
})
