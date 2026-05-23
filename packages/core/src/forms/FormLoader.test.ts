import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- fs/promises mock via vi.mock ---
const mockReaddir = vi.fn()
const mockReadFile = vi.fn()

vi.mock('fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}))

import { FormLoader } from './FormLoader.js'

const CONTENT_DIR = '/content'

const VALID_BLUEPRINT_YAML = `
name: contact
fields:
  - name: name
    type: text
    label: Full Name
    required: true
  - name: email
    type: email
    label: Email Address
    required: true
  - name: message
    type: textarea
    label: Message
    required: false
actions:
  email:
    to: admin@example.com
    subject: New Contact Submission
`.trim()

const MINIMAL_BLUEPRINT_YAML = `
name: simple
fields:
  - name: email
    type: email
    label: Email
    required: true
actions: {}
`.trim()

describe('FormLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load()', () => {
    it('parses a valid YAML blueprint correctly', async () => {
      mockReadFile.mockResolvedValueOnce(VALID_BLUEPRINT_YAML)

      const loader = new FormLoader(CONTENT_DIR)
      const blueprint = await loader.load('contact')

      expect(blueprint.name).toBe('contact')
      expect(blueprint.fields).toHaveLength(3)
      expect(blueprint.fields[0]).toMatchObject({
        name: 'name',
        type: 'text',
        label: 'Full Name',
        required: true,
      })
      expect(blueprint.fields[1]).toMatchObject({
        name: 'email',
        type: 'email',
        label: 'Email Address',
        required: true,
      })
      expect(blueprint.actions.email?.to).toBe('admin@example.com')
      expect(blueprint.honeypot).toBe('_gotcha')
      expect(blueprint.rateLimit).toBe(5)
    })

    it('throws a meaningful error when YAML is syntactically invalid', async () => {
      mockReadFile.mockResolvedValueOnce('name: [\ninvalid yaml')

      const loader = new FormLoader(CONTENT_DIR)
      await expect(loader.load('bad')).rejects.toThrow(/Invalid YAML/)
    })

    it('throws when blueprint fails schema validation', async () => {
      // missing required `name` field in blueprint root
      mockReadFile.mockResolvedValueOnce('fields: []\nactions: {}')

      const loader = new FormLoader(CONTENT_DIR)
      await expect(loader.load('missing-name')).rejects.toThrow(/Invalid form blueprint/)
    })

    it('throws when form blueprint file is not found', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FormLoader(CONTENT_DIR)
      await expect(loader.load('nonexistent')).rejects.toThrow(/not found/)
    })
  })

  describe('loadAll()', () => {
    it('returns all valid blueprints from the forms directory', async () => {
      mockReaddir.mockResolvedValueOnce(['contact.yaml', 'newsletter.yaml', 'README.md'])
      // contact.yaml
      mockReadFile.mockResolvedValueOnce(VALID_BLUEPRINT_YAML)
      // newsletter.yaml
      mockReadFile.mockResolvedValueOnce(MINIMAL_BLUEPRINT_YAML)

      const loader = new FormLoader(CONTENT_DIR)
      const blueprints = await loader.loadAll()

      expect(blueprints).toHaveLength(2)
      expect(blueprints.map(b => b.name)).toContain('contact')
      expect(blueprints.map(b => b.name)).toContain('simple')
    })

    it('returns empty array when forms directory does not exist', async () => {
      mockReaddir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FormLoader(CONTENT_DIR)
      const blueprints = await loader.loadAll()

      expect(blueprints).toEqual([])
    })
  })

  describe('validate()', () => {
    it('passes validation when all required fields are present', async () => {
      mockReadFile.mockResolvedValue(VALID_BLUEPRINT_YAML)

      const loader = new FormLoader(CONTENT_DIR)
      const result = await loader.validate('contact', {
        name: 'Alice',
        email: 'alice@example.com',
        message: 'Hello!',
      })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns error when a required field is missing', async () => {
      mockReadFile.mockResolvedValue(VALID_BLUEPRINT_YAML)

      const loader = new FormLoader(CONTENT_DIR)
      const result = await loader.validate('contact', {
        email: 'alice@example.com',
        // name is missing
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('name')
      expect(result.errors[0].message).toMatch(/required/i)
    })

    it('returns error when email field contains an invalid email', async () => {
      mockReadFile.mockResolvedValue(VALID_BLUEPRINT_YAML)

      const loader = new FormLoader(CONTENT_DIR)
      const result = await loader.validate('contact', {
        name: 'Alice',
        email: 'not-an-email',
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'email')).toBe(true)
    })

    it('validates min/max length constraints', async () => {
      const yamlWithValidation = `
name: feedback
fields:
  - name: comment
    type: text
    label: Comment
    required: true
    validation:
      min: 10
      max: 100
actions: {}
`.trim()

      mockReadFile.mockResolvedValue(yamlWithValidation)

      const loader = new FormLoader(CONTENT_DIR)
      const result = await loader.validate('feedback', { comment: 'short' })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'comment')).toBe(true)
    })

    it('validates pattern constraints', async () => {
      const yamlWithPattern = `
name: code
fields:
  - name: postal
    type: text
    label: Postal Code
    required: true
    validation:
      pattern: "^[0-9]{5}$"
actions: {}
`.trim()

      mockReadFile.mockResolvedValue(yamlWithPattern)

      const loader = new FormLoader(CONTENT_DIR)
      const result = await loader.validate('code', { postal: 'ABC12' })

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'postal')).toBe(true)
    })
  })
})
