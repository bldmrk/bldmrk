import { readFile, readdir } from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import { FrontmatterSchema } from './FrontmatterSchema.js'
import { PageNotFoundError } from './errors.js'
import type { PageObject } from './types.js'

const FOLDER_RE = /^\d+--(.+)$/

export class PageLoader {
  private cache = new Map<string, PageObject>()

  constructor(private contentDir: string) {}

  async load(slug: string): Promise<PageObject> {
    if (this.cache.has(slug)) {
      return this.cache.get(slug)!
    }

    const entries = await readdir(this.contentDir)
    const folderName = entries.find(e => {
      const match = FOLDER_RE.exec(e)
      return match !== null && match[1] === slug
    })

    if (!folderName) {
      throw new PageNotFoundError(slug)
    }

    const folderPath = path.join(this.contentDir, folderName)
    const mdxSource = await readFile(path.join(folderPath, 'index.mdx'), 'utf-8')

    let pageYaml: Record<string, unknown> = {}
    try {
      const yamlSource = await readFile(path.join(folderPath, 'page.yaml'), 'utf-8')
      pageYaml = yaml.load(yamlSource) as Record<string, unknown>
    } catch {
      // no page.yaml - schema defaults apply
    }

    const { data: mdxFrontmatter, content: rawContent } = matter(mdxSource)
    const merged = { ...pageYaml, ...mdxFrontmatter }
    const meta = FrontmatterSchema.parse(merged)

    const page: PageObject = { slug, path: folderPath, rawContent, meta }
    this.cache.set(slug, page)
    return page
  }

  async loadAll(): Promise<PageObject[]> {
    const entries = await readdir(this.contentDir)
    const slugs = entries
      .map(e => FOLDER_RE.exec(e)?.[1])
      .filter((s): s is string => s !== undefined)

    return Promise.all(slugs.map(s => this.load(s)))
  }

  invalidate(slug: string): void {
    this.cache.delete(slug)
  }

  invalidateAll(): void {
    this.cache.clear()
  }
}
