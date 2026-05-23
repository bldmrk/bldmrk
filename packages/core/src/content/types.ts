import type { Frontmatter } from './FrontmatterSchema.js'

export interface PageObject {
  slug: string
  path: string
  rawContent: string
  meta: Frontmatter
  children?: PageObject[]
}
