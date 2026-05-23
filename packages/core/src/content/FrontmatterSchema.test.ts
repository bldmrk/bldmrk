import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { FrontmatterSchema } from './FrontmatterSchema.js'

describe('FrontmatterSchema', () => {
  it('validates minimal input with only title', () => {
    const result = FrontmatterSchema.parse({ title: 'Home' })
    expect(result.title).toBe('Home')
  })

  it('validates a full example with all fields', () => {
    const input = {
      title: 'Meine Seite',
      description: 'SEO-Beschreibung',
      template: 'default',
      published: true,
      date: '2024-01-15',
      author: 'jonas',
      tags: ['news'],
      menu: {
        visible: true,
        label: 'Home',
        icon: 'home',
        order: 1,
      },
      routes: {
        default: '/home',
        aliases: ['/'],
      },
      i18n: {
        de: '001--home',
        en: '001--home.en',
      },
    }
    const result = FrontmatterSchema.parse(input)
    expect(result.title).toBe('Meine Seite')
    expect(result.tags).toEqual(['news'])
    expect(result.menu?.icon).toBe('home')
    expect(result.routes?.aliases).toEqual(['/'])
    expect(result.i18n?.de).toBe('001--home')
  })

  it('throws ZodError with path ["title"] when title is missing', () => {
    const result = FrontmatterSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['title'])
    }
  })

  it('strips unknown fields without throwing', () => {
    const result = FrontmatterSchema.parse({
      title: 'Test',
      unknownField: 'should be removed',
      anotherExtra: 42,
    })
    expect(result.title).toBe('Test')
    expect((result as Record<string, unknown>).unknownField).toBeUndefined()
    expect((result as Record<string, unknown>).anotherExtra).toBeUndefined()
  })

  it('defaults published to true when not provided', () => {
    const result = FrontmatterSchema.parse({ title: 'Test' })
    expect(result.published).toBe(true)
  })

  it('defaults template to "default" when not provided', () => {
    const result = FrontmatterSchema.parse({ title: 'Test' })
    expect(result.template).toBe('default')
  })
})
