import { describe, it, expect } from 'vitest'
import { FlexFieldSchema } from './FlexSchema.js'

describe('FlexFieldSchema new field types', () => {
  it('accepts markdown type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'body', type: 'markdown', label: 'Body' })
    expect(result.success).toBe(true)
  })
  it('accepts slug type with source', () => {
    const result = FlexFieldSchema.safeParse({ name: 'slug', type: 'slug', label: 'Slug', source: 'title' })
    expect(result.success).toBe(true)
  })
  it('accepts tags type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'tags', type: 'tags', label: 'Tags' })
    expect(result.success).toBe(true)
  })
  it('accepts section type with nested fields', () => {
    const result = FlexFieldSchema.safeParse({
      name: 'seo_section', type: 'section', label: 'SEO',
      fields: [{ name: 'meta_desc', type: 'textarea', label: 'Meta Description' }],
    })
    expect(result.success).toBe(true)
  })
  it('accepts template type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'template', type: 'template', label: 'Template' })
    expect(result.success).toBe(true)
  })
  it('accepts datetime type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'published_at', type: 'datetime', label: 'Published At' })
    expect(result.success).toBe(true)
  })
  it('accepts file type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'attachment', type: 'file', label: 'Attachment' })
    expect(result.success).toBe(true)
  })
  it('accepts hidden type', () => {
    const result = FlexFieldSchema.safeParse({ name: 'version', type: 'hidden', label: 'Version', default: 1 })
    expect(result.success).toBe(true)
  })
  it('accepts condition property', () => {
    const result = FlexFieldSchema.safeParse({
      name: 'sidebar', type: 'textarea', label: 'Sidebar',
      condition: { field: 'show_sidebar', value: true },
    })
    expect(result.success).toBe(true)
  })
  it('accepts placeholder and help properties', () => {
    const result = FlexFieldSchema.safeParse({
      name: 'title', type: 'text', label: 'Title',
      placeholder: 'Enter title…', help: 'This will appear as the page heading.',
    })
    expect(result.success).toBe(true)
  })
})
