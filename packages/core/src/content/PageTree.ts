import { readdir, readFile } from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import { FrontmatterSchema } from './FrontmatterSchema.js'
import type { PageObject } from './types.js'
import type { PageLoader } from './PageLoader.js'

const FOLDER_RE = /^(\d+)--(.+)$/

interface TreeNode {
  page: PageObject
  routePath: string
  numericOrder: number
  parent: TreeNode | undefined
  children: TreeNode[]
}

export class PageTree {
  private nodes = new Map<string, TreeNode>()
  private routeIndex = new Map<string, TreeNode>()

  constructor(private contentDir: string, private loader: PageLoader) {}

  async build(): Promise<void> {
    this.nodes.clear()
    this.routeIndex.clear()
    await this.scanDir(this.contentDir, '', undefined)
  }

  private async scanDir(dir: string, routePrefix: string, parent: TreeNode | undefined): Promise<void> {
    const entries = await readdir(dir)
    const folders = entries
      .map(e => ({ entry: e, match: FOLDER_RE.exec(e) }))
      .filter((item): item is { entry: string; match: RegExpExecArray } => item.match !== null)
      .map(({ entry, match }) => ({
        entry,
        numericOrder: parseInt(match[1], 10),
        slug: match[2],
      }))
      .sort((a, b) => a.numericOrder - b.numericOrder)

    for (const { entry, numericOrder, slug } of folders) {
      const folderPath = path.join(dir, entry)
      const page = await this.loadPage(folderPath, slug)
      const routePath = `${routePrefix}/${slug}`

      const node: TreeNode = { page, routePath, numericOrder, parent, children: [] }

      this.nodes.set(slug, node)
      this.routeIndex.set(routePath, node)

      if (page.meta.routes?.aliases) {
        for (const alias of page.meta.routes.aliases) {
          this.routeIndex.set(alias, node)
        }
      }

      if (parent) {
        parent.children.push(node)
      }

      await this.scanDir(folderPath, routePath, node)
    }
  }

  private async loadPage(folderPath: string, slug: string): Promise<PageObject> {
    const mdxSource = await readFile(path.join(folderPath, 'index.mdx'), 'utf-8')

    let pageYaml: Record<string, unknown> = {}
    try {
      const yamlSource = await readFile(path.join(folderPath, 'page.yaml'), 'utf-8')
      pageYaml = yaml.load(yamlSource) as Record<string, unknown>
    } catch {
      // no page.yaml — schema defaults apply
    }

    const { data: mdxFrontmatter, content: rawContent } = matter(mdxSource)
    const merged = { ...pageYaml, ...mdxFrontmatter }
    const meta = FrontmatterSchema.parse(merged)

    return { slug, path: folderPath, rawContent, meta }
  }

  getBySlug(slug: string): PageObject | undefined {
    return this.nodes.get(slug)?.page
  }

  getByRoute(route: string): PageObject | undefined {
    return this.routeIndex.get(route)?.page
  }

  getChildren(slug: string): PageObject[] {
    return this.nodes.get(slug)?.children.map(n => n.page) ?? []
  }

  getParent(slug: string): PageObject | undefined {
    return this.nodes.get(slug)?.parent?.page
  }

  getPrev(slug: string): PageObject | undefined {
    const node = this.nodes.get(slug)
    if (!node?.parent) return undefined
    const siblings = node.parent.children
    const idx = siblings.indexOf(node)
    return idx > 0 ? siblings[idx - 1].page : undefined
  }

  getNext(slug: string): PageObject | undefined {
    const node = this.nodes.get(slug)
    if (!node?.parent) return undefined
    const siblings = node.parent.children
    const idx = siblings.indexOf(node)
    return idx < siblings.length - 1 ? siblings[idx + 1].page : undefined
  }

  getNavigation(): PageObject[] {
    const topLevel: TreeNode[] = []
    for (const node of this.nodes.values()) {
      if (!node.parent && node.page.meta.published !== false) {
        topLevel.push(node)
      }
    }
    return topLevel
      .sort((a, b) => {
        const aOrder = a.page.meta.menu?.order ?? a.numericOrder
        const bOrder = b.page.meta.menu?.order ?? b.numericOrder
        return aOrder - bOrder
      })
      .map(n => n.page)
  }
}
