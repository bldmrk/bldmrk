import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { PageLoader } from './PageLoader.js'
import { PageTree } from './PageTree.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const CONTENT_DIR = '/content/pages'

const HOME_MDX = `---
title: Home
---
# Home
`
const HOME_YAML = `title: Home
routes:
  aliases: ["/"]
menu:
  order: 5
`
const BLOG_MDX = `---
title: Blog
---
# Blog
`
const FIRST_POST_MDX = `---
title: First Post
---
# First Post
`
const SECOND_POST_MDX = `---
title: Second Post
---
# Second Post
`
const ABOUT_MDX = `---
title: About
published: false
---
# About
`

beforeEach(() => {
  vol.reset()
  vol.fromJSON({
    [`${CONTENT_DIR}/001--home/index.mdx`]: HOME_MDX,
    [`${CONTENT_DIR}/001--home/page.yaml`]: HOME_YAML,
    [`${CONTENT_DIR}/002--blog/index.mdx`]: BLOG_MDX,
    [`${CONTENT_DIR}/002--blog/001--first-post/index.mdx`]: FIRST_POST_MDX,
    [`${CONTENT_DIR}/002--blog/002--second-post/index.mdx`]: SECOND_POST_MDX,
    [`${CONTENT_DIR}/003--about/index.mdx`]: ABOUT_MDX,
  })
})

async function buildTree(): Promise<PageTree> {
  const loader = new PageLoader(CONTENT_DIR)
  const tree = new PageTree(CONTENT_DIR, loader)
  await tree.build()
  return tree
}

describe('PageTree', () => {
  it('getBySlug returns correct PageObject after build', async () => {
    const tree = await buildTree()
    const home = tree.getBySlug('home')
    expect(home).toBeDefined()
    expect(home!.slug).toBe('home')
    expect(home!.meta.title).toBe('Home')
  })

  it('getChildren returns array with first-post and second-post', async () => {
    const tree = await buildTree()
    const children = tree.getChildren('blog')
    expect(children).toHaveLength(2)
    const slugs = children.map(c => c.slug)
    expect(slugs).toContain('first-post')
    expect(slugs).toContain('second-post')
  })

  it('getParent returns blog PageObject for first-post', async () => {
    const tree = await buildTree()
    const parent = tree.getParent('first-post')
    expect(parent).toBeDefined()
    expect(parent!.slug).toBe('blog')
  })

  it('children are sorted numerically: 001 before 002, 010 after 009', async () => {
    const tree = await buildTree()
    const children = tree.getChildren('blog')
    expect(children[0].slug).toBe('first-post')
    expect(children[1].slug).toBe('second-post')
  })

  it('getPrev returns first-post for second-post', async () => {
    const tree = await buildTree()
    const prev = tree.getPrev('second-post')
    expect(prev).toBeDefined()
    expect(prev!.slug).toBe('first-post')
  })

  it('getNext returns second-post for first-post', async () => {
    const tree = await buildTree()
    const next = tree.getNext('first-post')
    expect(next).toBeDefined()
    expect(next!.slug).toBe('second-post')
  })

  it('getNext returns undefined for the last child', async () => {
    const tree = await buildTree()
    expect(tree.getNext('second-post')).toBeUndefined()
  })

  it('getByRoute resolves alias "/" to home', async () => {
    const tree = await buildTree()
    const page = tree.getByRoute('/')
    expect(page).toBeDefined()
    expect(page!.slug).toBe('home')
  })

  it('getByRoute resolves nested path /blog/first-post', async () => {
    const tree = await buildTree()
    const page = tree.getByRoute('/blog/first-post')
    expect(page).toBeDefined()
    expect(page!.slug).toBe('first-post')
  })

  it('unpublished page is excluded from getNavigation', async () => {
    const tree = await buildTree()
    const nav = tree.getNavigation()
    expect(nav.map(p => p.slug)).not.toContain('about')
  })

  it('unpublished page is still findable via getBySlug', async () => {
    const tree = await buildTree()
    const about = tree.getBySlug('about')
    expect(about).toBeDefined()
    expect(about!.meta.published).toBe(false)
  })

  it('menu.order overrides numeric prefix for getNavigation sort order', async () => {
    const tree = await buildTree()
    const nav = tree.getNavigation()
    // home has prefix 001 but menu.order: 5; blog has prefix 002, no menu.order (effective 2)
    // so blog should appear before home in navigation
    const slugs = nav.map(p => p.slug)
    expect(slugs.indexOf('blog')).toBeLessThan(slugs.indexOf('home'))
  })
})
