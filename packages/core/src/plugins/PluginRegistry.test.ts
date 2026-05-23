import { describe, it, expect, beforeEach } from 'vitest'
import { PluginRegistry } from './PluginRegistry.js'

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => { registry = new PluginRegistry() })

  it('registers and lists a plugin', () => {
    registry.register({ name: 'test-plugin', version: '1.0.0', enabled: true })
    expect(registry.list()).toEqual([{ name: 'test-plugin', version: '1.0.0', enabled: true }])
  })

  it('get() returns registered plugin', () => {
    registry.register({ name: 'foo', version: '2.0.0', enabled: true })
    expect(registry.get('foo')).toMatchObject({ name: 'foo' })
  })

  it('get() returns undefined for unknown plugin', () => {
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('isEnabled() returns true for enabled plugin', () => {
    registry.register({ name: 'foo', version: '1.0.0', enabled: true })
    expect(registry.isEnabled('foo')).toBe(true)
  })

  it('isEnabled() returns false for unknown plugin', () => {
    expect(registry.isEnabled('unknown')).toBe(false)
  })

  it('overwrites on duplicate register', () => {
    registry.register({ name: 'foo', version: '1.0.0', enabled: true })
    registry.register({ name: 'foo', version: '2.0.0', enabled: false })
    expect(registry.get('foo')?.version).toBe('2.0.0')
    expect(registry.list()).toHaveLength(1)
  })
})
