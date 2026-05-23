import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import { PluginLoader } from './PluginLoader.js'
import { PluginRegistry } from './PluginRegistry.js'
import { HookSystem } from './HookSystem.js'
import { PluginAPIImpl } from './PluginAPI.js'
import type { BldmrkHooks } from './types.js'

let tmpDir: string
let registry: PluginRegistry
let api: PluginAPIImpl

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-plugins-test-'))
  registry = new PluginRegistry()
  api = new PluginAPIImpl(new HookSystem<BldmrkHooks>())
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true })
})

describe('PluginLoader', () => {
  it('returns empty list when plugins.yaml missing', async () => {
    const loader = new PluginLoader(tmpDir, api, registry)
    expect(await loader.readPluginNames()).toEqual([])
  })

  it('reads plugin names from plugins.yaml', async () => {
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- bldmrk-plugin-seo\n- bldmrk-plugin-rss\n')
    const loader = new PluginLoader(tmpDir, api, registry)
    expect(await loader.readPluginNames()).toEqual(['bldmrk-plugin-seo', 'bldmrk-plugin-rss'])
  })

  it('loads and registers a valid plugin', async () => {
    const setupFn = vi.fn()
    const mockImport = vi.fn().mockResolvedValue({
      default: { name: 'test-plugin', version: '1.0.0', setup: setupFn },
    })
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- test-plugin\n')
    const loader = new PluginLoader(tmpDir, api, registry, mockImport)
    await loader.load()
    expect(setupFn).toHaveBeenCalledWith(api)
    expect(registry.isEnabled('test-plugin')).toBe(true)
  })

  it('skips plugin with invalid shape', async () => {
    const mockImport = vi.fn().mockResolvedValue({ default: { notAPlugin: true } })
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- bad-plugin\n')
    const loader = new PluginLoader(tmpDir, api, registry, mockImport)
    await loader.load()
    expect(registry.list()).toHaveLength(0)
  })

  it('skips plugin that fails to import', async () => {
    const mockImport = vi.fn().mockRejectedValue(new Error('not found'))
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- missing-plugin\n')
    const loader = new PluginLoader(tmpDir, api, registry, mockImport)
    await expect(loader.load()).resolves.toBeUndefined()
    expect(registry.list()).toHaveLength(0)
  })

  it('continues loading after one plugin fails setup', async () => {
    const goodSetup = vi.fn()
    const mockImport = vi.fn()
      .mockResolvedValueOnce({ default: { name: 'p1', version: '1.0.0', setup: () => { throw new Error('fail') } } })
      .mockResolvedValueOnce({ default: { name: 'p2', version: '1.0.0', setup: goodSetup } })
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- p1\n- p2\n')
    const loader = new PluginLoader(tmpDir, api, registry, mockImport)
    await loader.load()
    expect(goodSetup).toHaveBeenCalled()
    expect(registry.isEnabled('p2')).toBe(true)
  })

  it('addPlugin appends to plugins.yaml', async () => {
    const loader = new PluginLoader(tmpDir, api, registry)
    await loader.addPlugin('bldmrk-plugin-seo')
    expect(await loader.readPluginNames()).toContain('bldmrk-plugin-seo')
  })

  it('removePlugin removes from plugins.yaml', async () => {
    await writeFile(path.join(tmpDir, 'plugins.yaml'), '- bldmrk-plugin-seo\n- bldmrk-plugin-rss\n')
    const loader = new PluginLoader(tmpDir, api, registry)
    await loader.removePlugin('bldmrk-plugin-seo')
    expect(await loader.readPluginNames()).toEqual(['bldmrk-plugin-rss'])
  })
})
