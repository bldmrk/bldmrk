import { describe, it, expect } from 'vitest'
import { ContentParser } from './ContentParser.js'

describe('ContentParser', () => {
  const parser = new ContentParser()

  it('parses plain Markdown text and returns compiled JS with correct meta and rawContent', async () => {
    const mdxSource = `# Hello World

This is a paragraph with **bold** and _italic_ text.`
    const result = await parser.parse(mdxSource, { title: 'Hello World' })
    expect(typeof result.html).toBe('string')
    expect(result.html).toContain('_createMdxContent')
    expect(result.meta.title).toBe('Hello World')
    expect(result.rawContent).toContain('Hello World')
    expect(result.rawContent).not.toContain('---')
  })

  it('parses MDX with an import statement without throwing', async () => {
    const mdxSource = `import MyComponent from './MyComponent.js'

# Page with Component

<MyComponent />`
    await expect(
      parser.parse(mdxSource, { title: 'MDX Page' })
    ).resolves.toBeDefined()
  })

  it('extracts and validates frontmatter from MDX (meta.title matches)', async () => {
    const mdxSource = `---
title: "My MDX Page"
description: "A test page"
---

# Content here`
    const result = await parser.parse(mdxSource)
    expect(result.meta.title).toBe('My MDX Page')
    expect(result.meta.description).toBe('A test page')
  })

  it('MDX frontmatter overrides pageYaml title', async () => {
    const mdxSource = `---
title: "Override"
---

Content here.`
    const result = await parser.parse(mdxSource, { title: 'Original' })
    expect(result.meta.title).toBe('Override')
  })

  it('preserves page.yaml fields not overridden by MDX frontmatter', async () => {
    const mdxSource = `---
title: "MDX Title"
---

Content.`
    const result = await parser.parse(mdxSource, {
      title: 'Original',
      author: 'jonas',
      tags: ['news', 'featured'],
    })
    expect(result.meta.title).toBe('MDX Title')
    expect(result.meta.author).toBe('jonas')
    expect(result.meta.tags).toEqual(['news', 'featured'])
  })

  it('throws when frontmatter is invalid (missing title, no pageYaml fallback)', async () => {
    const mdxSource = `---
description: "No title here"
---

Content.`
    await expect(parser.parse(mdxSource)).rejects.toThrow()
  })
})
