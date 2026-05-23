import matter from 'gray-matter'
import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import { FrontmatterSchema, type Frontmatter } from './FrontmatterSchema.js'

export interface ParseResult {
  /** Compiled MDX/Markdown output as a JS module function-body string */
  html: string
  meta: Frontmatter
  rawContent: string
}

export class ContentParser {
  async parse(
    mdxSource: string,
    pageYaml?: Record<string, unknown>
  ): Promise<ParseResult> {
    const { data: mdxFrontmatter, content: rawContent } = matter(mdxSource)
    const merged = { ...pageYaml, ...mdxFrontmatter }
    const meta = FrontmatterSchema.parse(merged)
    const compiled = await compile(rawContent, {
      remarkPlugins: [remarkGfm],
      outputFormat: 'function-body',
    })

    return {
      html: String(compiled),
      meta,
      rawContent,
    }
  }
}
