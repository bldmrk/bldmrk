import { describe, it, expect, beforeEach } from 'vitest'
import { SearchIndex } from './SearchIndex.js'
import type { PageObject } from '../content/types.js'

function makePage(overrides: Partial<PageObject> & { slug: string }): PageObject {
  return {
    slug: overrides.slug,
    path: `/content/pages/${overrides.slug}`,
    rawContent: overrides.rawContent ?? `This is the content for ${overrides.slug}`,
    meta: {
      title: overrides.meta?.title ?? `Page ${overrides.slug}`,
      published: overrides.meta?.published ?? true,
      template: 'default',
      ...(overrides.meta ?? {}),
    },
    children: overrides.children,
  }
}

describe('SearchIndex', () => {
  let index: SearchIndex

  beforeEach(() => {
    index = new SearchIndex()
  })

  it('indexes 3 pages and finds the correct one by keyword', () => {
    const pages = [
      makePage({ slug: 'home', rawContent: 'Willkommen auf unserer Webseite. Hier finden Sie Informationen.', meta: { title: 'Home', published: true, template: 'default' } }),
      makePage({ slug: 'about', rawContent: 'Über uns und unsere Geschichte seit 2020.', meta: { title: 'About', published: true, template: 'default' } }),
      makePage({ slug: 'contact', rawContent: 'Kontaktieren Sie uns per Email oder Telefon.', meta: { title: 'Contact', published: true, template: 'default' } }),
    ]
    index.index(pages)

    const results = index.search('willkommen')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.slug).toBe('home')
  })

  it('does not index draft pages (published: false)', () => {
    const pages = [
      makePage({ slug: 'draft-page', rawContent: 'This is a secret draft content', meta: { title: 'Draft', published: false, template: 'default' } }),
      makePage({ slug: 'public-page', rawContent: 'This is public content', meta: { title: 'Public', published: true, template: 'default' } }),
    ]
    index.index(pages)

    const results = index.search('secret draft')
    expect(results.every(r => r.slug !== 'draft-page')).toBe(true)
  })

  it('remove(slug) removes the page from search results', () => {
    const pages = [
      makePage({ slug: 'removable', rawContent: 'This page will be removed from the index', meta: { title: 'Removable', published: true, template: 'default' } }),
    ]
    index.index(pages)

    // Verify it's found before removal
    const before = index.search('removable')
    expect(before.length).toBeGreaterThan(0)

    index.remove('removable')

    const after = index.search('removable')
    expect(after.every(r => r.slug !== 'removable')).toBe(true)
  })

  it('rebuild([]) clears all results', () => {
    const pages = [
      makePage({ slug: 'alpha', rawContent: 'Alpha content here', meta: { title: 'Alpha', published: true, template: 'default' } }),
      makePage({ slug: 'beta', rawContent: 'Beta content here', meta: { title: 'Beta', published: true, template: 'default' } }),
    ]
    index.index(pages)
    expect(index.search('alpha').length).toBeGreaterThan(0)

    index.rebuild([])

    expect(index.search('alpha')).toHaveLength(0)
    expect(index.search('beta')).toHaveLength(0)
  })

  it('excerpt contains context around the search term (±100 chars)', () => {
    const longContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'The keyword extraordinarius appears right here in the middle of the text. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.'

    const pages = [
      makePage({ slug: 'excerpt-test', rawContent: longContent, meta: { title: 'Excerpt Test', published: true, template: 'default' } }),
    ]
    index.index(pages)

    const results = index.search('extraordinarius')
    expect(results.length).toBeGreaterThan(0)
    const result = results[0]!
    expect(result.excerpt).toContain('extraordinarius')
    // Excerpt should be at most ~200 chars (100 before + term + 100 after)
    expect(result.excerpt.length).toBeLessThanOrEqual(220)
  })

  it('add() adds a single page to the index', () => {
    const page = makePage({ slug: 'added', rawContent: 'A newly added page with unique content', meta: { title: 'Added', published: true, template: 'default' } })
    index.add(page)

    const results = index.search('unique content')
    expect(results.some(r => r.slug === 'added')).toBe(true)
  })

  it('search returns empty array for empty query', () => {
    const pages = [makePage({ slug: 'any', rawContent: 'Some content', meta: { title: 'Any', published: true, template: 'default' } })]
    index.index(pages)

    expect(index.search('')).toHaveLength(0)
    expect(index.search('   ')).toHaveLength(0)
  })

  it('respects the limit parameter', () => {
    const pages = Array.from({ length: 10 }, (_, i) =>
      makePage({ slug: `page-${i}`, rawContent: `Common search term content page ${i}`, meta: { title: `Page ${i}`, published: true, template: 'default' } }),
    )
    index.index(pages)

    const results = index.search('common search term', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})
