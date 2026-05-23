import { describe, it, expect } from 'vitest'
import { BlueprintDefinitionSchema } from './BlueprintSchema.js'

describe('BlueprintDefinitionSchema', () => {
  it('accepts blueprint with tabs', () => {
    const result = BlueprintDefinitionSchema.safeParse({
      name: 'default',
      label: 'Default Page',
      tabs: [
        { id: 'content', label: 'Content', fields: [{ name: '_content', type: 'markdown', label: 'Content' }] },
        { id: 'meta', label: 'Metadata', fields: [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'slug', type: 'slug', label: 'Slug', source: 'title' },
        ]},
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts blueprint with flat fields (Flex-style)', () => {
    const result = BlueprintDefinitionSchema.safeParse({
      name: 'products',
      label: 'Products',
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'price', type: 'number', label: 'Price' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional extends field', () => {
    const result = BlueprintDefinitionSchema.safeParse({
      name: 'blog', label: 'Blog Post', extends: 'default', tabs: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects blueprint with neither tabs nor fields', () => {
    const result = BlueprintDefinitionSchema.safeParse({ name: 'empty', label: 'Empty' })
    expect(result.success).toBe(false)
  })

  it('rejects blueprint with both tabs and fields', () => {
    const result = BlueprintDefinitionSchema.safeParse({
      name: 'conflict', label: 'Conflict', tabs: [], fields: [],
    })
    expect(result.success).toBe(false)
  })
})
