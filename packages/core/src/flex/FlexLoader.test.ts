import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- fs/promises mock via vi.mock ---
const mockReaddir = vi.fn()
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
const mockMkdir = vi.fn()
const mockUnlink = vi.fn()

vi.mock('fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}))

import { FlexLoader, FlexValidationException } from './FlexLoader.js'

const CONTENT_DIR = '/content'

const PRODUCTS_SCHEMA_YAML = `
name: products
label: Products
labelField: name
icon: box
public: true
fields:
  - name: name
    type: text
    label: Product Name
    required: true
  - name: price
    type: number
    label: Price
    required: true
  - name: description
    type: textarea
    label: Description
    required: false
admin:
  list:
    - name
    - price
  sort: name
`.trim()

const ENTRY_YAML = `
name: Widget Pro
price: 49.99
description: A great widget
_createdAt: '2024-01-01T00:00:00.000Z'
_updatedAt: '2024-01-02T00:00:00.000Z'
`.trim()

describe('FlexLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
  })

  describe('loadTypes()', () => {
    it('returns types from _schema.yaml files', async () => {
      mockReaddir.mockResolvedValueOnce(['products', 'team'])
      // products/_schema.yaml
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // team/_schema.yaml — missing/invalid, skip
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

      const loader = new FlexLoader(CONTENT_DIR)
      const types = await loader.loadTypes()

      expect(types).toHaveLength(1)
      expect(types[0].name).toBe('products')
      expect(types[0].labelField).toBe('name')
      expect(types[0].public).toBe(true)
      expect(types[0].fields).toHaveLength(3)
    })

    it('returns empty array when flex directory does not exist', async () => {
      mockReaddir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FlexLoader(CONTENT_DIR)
      const types = await loader.loadTypes()

      expect(types).toEqual([])
    })
  })

  describe('loadEntries()', () => {
    it('returns all YAML entries for a type', async () => {
      mockReaddir.mockResolvedValueOnce(['widget-pro.yaml', 'gadget.yaml', 'README.md'])
      // widget-pro entry
      mockReadFile.mockResolvedValueOnce(ENTRY_YAML)
      // gadget entry
      mockReadFile.mockResolvedValueOnce(`
name: Gadget Plus
price: 29.99
_createdAt: '2024-01-01T00:00:00.000Z'
_updatedAt: '2024-01-01T00:00:00.000Z'
`.trim())

      const loader = new FlexLoader(CONTENT_DIR)
      const entries = await loader.loadEntries('products')

      expect(entries).toHaveLength(2)
      expect(entries[0].id).toBe('widget-pro')
      expect(entries[0].typeName).toBe('products')
      expect(entries[0].data['name']).toBe('Widget Pro')
      expect(entries[0].data['price']).toBe(49.99)
      expect(entries[0].createdAt).toBeInstanceOf(Date)
    })

    it('returns empty array when entries directory does not exist', async () => {
      mockReaddir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FlexLoader(CONTENT_DIR)
      const entries = await loader.loadEntries('products')

      expect(entries).toEqual([])
    })
  })

  describe('loadEntry()', () => {
    it('loads a single entry by id', async () => {
      mockReadFile.mockResolvedValueOnce(ENTRY_YAML)

      const loader = new FlexLoader(CONTENT_DIR)
      const entry = await loader.loadEntry('products', 'widget-pro')

      expect(entry.id).toBe('widget-pro')
      expect(entry.typeName).toBe('products')
      expect(entry.data['name']).toBe('Widget Pro')
      expect(entry.data['_createdAt']).toBeUndefined()
      expect(entry.createdAt).toBeInstanceOf(Date)
    })

    it('throws when entry file does not exist', async () => {
      mockReadFile.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FlexLoader(CONTENT_DIR)
      await expect(loader.loadEntry('products', 'missing')).rejects.toThrow(/not found/)
    })
  })

  describe('saveEntry()', () => {
    it('writes YAML file with updated timestamp', async () => {
      // loadType call
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // loadEntry call (check existing createdAt) — not found → new entry
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

      const loader = new FlexLoader(CONTENT_DIR)
      await loader.saveEntry('products', 'widget-pro', {
        name: 'Widget Pro',
        price: 49.99,
        description: 'A great widget',
      })

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('entries'),
        { recursive: true },
      )
      expect(mockWriteFile).toHaveBeenCalledOnce()
      const [filePath, content] = mockWriteFile.mock.calls[0] as [string, string, string]
      expect(filePath).toContain('widget-pro.yaml')
      expect(content).toContain('Widget Pro')
      expect(content).toContain('_updatedAt')
      expect(content).toContain('_createdAt')
    })

    it('throws FlexValidationException when a required field is missing', async () => {
      // loadType call
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)

      const loader = new FlexLoader(CONTENT_DIR)
      await expect(
        loader.saveEntry('products', 'bad', { description: 'no name or price' }),
      ).rejects.toThrow(FlexValidationException)

      try {
        // loadType again for second call
        mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
        await loader.saveEntry('products', 'bad', { description: 'no name or price' })
      } catch (e) {
        expect(e).toBeInstanceOf(FlexValidationException)
        const ve = e as FlexValidationException
        expect(ve.errors.some(err => err.field === 'name')).toBe(true)
        expect(ve.errors.some(err => err.field === 'price')).toBe(true)
      }
    })
  })

  describe('createEntry()', () => {
    it('creates a new YAML file with a slug-based ID from labelField', async () => {
      // loadType (inside createEntry → saveEntry)
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // readdir for existing entries (none)
      mockReaddir.mockResolvedValueOnce([])
      // loadType again (inside saveEntry)
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // loadEntry attempt (new entry, ENOENT)
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

      const loader = new FlexLoader(CONTENT_DIR)
      const id = await loader.createEntry('products', {
        name: 'Widget Pro',
        price: 49.99,
      })

      expect(id).toBe('widget-pro')
      expect(mockWriteFile).toHaveBeenCalledOnce()
      const [filePath] = mockWriteFile.mock.calls[0] as [string, string, string]
      expect(filePath).toContain('widget-pro.yaml')
    })

    it('generates a unique ID when slug already exists', async () => {
      // loadType (inside createEntry)
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // readdir — widget-pro already exists
      mockReaddir.mockResolvedValueOnce(['widget-pro.yaml'])
      // loadType again (inside saveEntry)
      mockReadFile.mockResolvedValueOnce(PRODUCTS_SCHEMA_YAML)
      // loadEntry attempt (new entry, ENOENT)
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))

      const loader = new FlexLoader(CONTENT_DIR)
      const id = await loader.createEntry('products', {
        name: 'Widget Pro',
        price: 99,
      })

      expect(id).toBe('widget-pro-1')
    })
  })

  describe('deleteEntry()', () => {
    it('removes the entry YAML file', async () => {
      const loader = new FlexLoader(CONTENT_DIR)
      await loader.deleteEntry('products', 'widget-pro')

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('widget-pro.yaml'),
      )
    })

    it('throws when file does not exist', async () => {
      mockUnlink.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      const loader = new FlexLoader(CONTENT_DIR)
      await expect(loader.deleteEntry('products', 'missing')).rejects.toThrow(/not found/)
    })
  })
})
