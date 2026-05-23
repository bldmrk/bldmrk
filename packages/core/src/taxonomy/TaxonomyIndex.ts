import type { PageObject } from '../content/types.js'

export interface TaxonomyEntry {
  value: string
  count: number
  slug: string
}

function toUrlSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export class TaxonomyIndex {
  private tagMap = new Map<string, PageObject[]>()
  private authorMap = new Map<string, PageObject[]>()
  private pageTagsMap = new Map<string, string[]>()

  rebuild(pages: PageObject[]): void {
    this.tagMap.clear()
    this.authorMap.clear()
    this.pageTagsMap.clear()

    for (const page of pages) {
      if (!page.meta.published) continue

      if (page.meta.tags && page.meta.tags.length > 0) {
        this.pageTagsMap.set(page.slug, page.meta.tags)
        for (const tag of page.meta.tags) {
          const existing = this.tagMap.get(tag) ?? []
          existing.push(page)
          this.tagMap.set(tag, existing)
        }
      }

      if (page.meta.author) {
        const existing = this.authorMap.get(page.meta.author) ?? []
        existing.push(page)
        this.authorMap.set(page.meta.author, existing)
      }
    }
  }

  getTags(): TaxonomyEntry[] {
    return Array.from(this.tagMap.entries())
      .map(([value, pages]) => ({
        value,
        count: pages.length,
        slug: toUrlSlug(value),
      }))
      .sort((a, b) => b.count - a.count)
  }

  getPagesByTag(tag: string): PageObject[] {
    return this.tagMap.get(tag) ?? []
  }

  getTagsForPage(slug: string): string[] {
    return this.pageTagsMap.get(slug) ?? []
  }

  getAuthors(): TaxonomyEntry[] {
    return Array.from(this.authorMap.entries())
      .map(([value, pages]) => ({
        value,
        count: pages.length,
        slug: toUrlSlug(value),
      }))
      .sort((a, b) => b.count - a.count)
  }

  getPagesByAuthor(author: string): PageObject[] {
    return this.authorMap.get(author) ?? []
  }
}
