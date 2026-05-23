import { Document } from 'flexsearch'
import type { PageObject } from '../content/types.js'

export interface SearchResult {
  slug: string
  title: string
  excerpt: string
  score: number
}

interface PageDoc {
  id: string
  title: string
  content: string
  [key: string]: string
}

function extractExcerpt(rawContent: string, query: string): string {
  const lowerContent = rawContent.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()

  // Find position of the first query word
  const words = lowerQuery.split(/\s+/)
  let pos = -1
  for (const word of words) {
    if (!word) continue
    const found = lowerContent.indexOf(word)
    if (found !== -1) {
      pos = found
      break
    }
  }

  if (pos === -1) {
    // Fallback: return beginning of content
    return rawContent.slice(0, 200).trimEnd()
  }

  const start = Math.max(0, pos - 100)
  const end = Math.min(rawContent.length, pos + 100 + words[0]!.length)
  let excerpt = rawContent.slice(start, end).trim()

  if (start > 0) excerpt = '…' + excerpt
  if (end < rawContent.length) excerpt = excerpt + '…'

  return excerpt
}

function createDocIndex(): Document<PageDoc> {
  return new Document<PageDoc>({
    document: {
      id: 'id',
      index: ['title', 'content'],
    },
    tokenize: 'forward',
  })
}

export class SearchIndex {
  private docIndex: Document<PageDoc>
  // slug -> { title, rawContent }
  private pageMap = new Map<string, { title: string; rawContent: string }>()

  constructor() {
    this.docIndex = createDocIndex()
  }

  index(pages: PageObject[]): void {
    this.docIndex = createDocIndex()
    this.pageMap.clear()

    for (const page of pages) {
      if (!page.meta.published) continue
      this._addToIndex(page)
    }
  }

  add(page: PageObject): void {
    if (!page.meta.published) return
    // Remove first if already exists
    if (this.pageMap.has(page.slug)) {
      this.remove(page.slug)
    }
    this._addToIndex(page)
  }

  remove(slug: string): void {
    if (this.pageMap.has(slug)) {
      this.docIndex.remove(slug)
      this.pageMap.delete(slug)
    }
  }

  search(query: string, limit = 10): SearchResult[] {
    const trimmed = query.trim()
    if (!trimmed) return []

    // rawResults: Array<{ field: string; result: string[] }>
    const rawResults = this.docIndex.search(trimmed, { limit }) as Array<{ field: string; result: string[] }>

    // Collect unique slugs (the ids ARE the slugs)
    const slugsSeen = new Set<string>()
    const results: SearchResult[] = []

    for (const fieldResult of rawResults) {
      const ids = fieldResult.result
      for (let i = 0; i < ids.length; i++) {
        const slug = ids[i]!
        if (slugsSeen.has(slug)) continue
        slugsSeen.add(slug)

        const pageData = this.pageMap.get(slug)
        if (!pageData) continue

        results.push({
          slug,
          title: pageData.title,
          excerpt: extractExcerpt(pageData.rawContent, trimmed),
          score: 1 / (i + 1),
        })

        if (results.length >= limit) break
      }
      if (results.length >= limit) break
    }

    return results
  }

  rebuild(pages: PageObject[]): void {
    this.index(pages)
  }

  private _addToIndex(page: PageObject): void {
    // Use slug directly as the document id
    this.pageMap.set(page.slug, { title: page.meta.title, rawContent: page.rawContent })
    this.docIndex.add({
      id: page.slug,
      title: page.meta.title,
      content: page.rawContent,
    })
  }
}
