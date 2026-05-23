import { describe, it, expect, vi } from 'vitest'
import { HookSystem } from './HookSystem.js'

type TestHooks = {
  'foo': { value: number }
  'bar': { msg: string }
}

describe('HookSystem', () => {
  it('calls registered handler with payload', async () => {
    const hooks = new HookSystem<TestHooks>()
    const handler = vi.fn()
    hooks.on('foo', handler)
    await hooks.emit('foo', { value: 42 })
    expect(handler).toHaveBeenCalledWith({ value: 42 })
  })

  it('calls multiple handlers in order', async () => {
    const hooks = new HookSystem<TestHooks>()
    const order: number[] = []
    hooks.on('foo', async () => { order.push(1) })
    hooks.on('foo', async () => { order.push(2) })
    await hooks.emit('foo', { value: 0 })
    expect(order).toEqual([1, 2])
  })

  it('isolates errors — other handlers still run', async () => {
    const hooks = new HookSystem<TestHooks>()
    const second = vi.fn()
    hooks.on('foo', async () => { throw new Error('boom') })
    hooks.on('foo', second)
    await expect(hooks.emit('foo', { value: 1 })).resolves.toBeUndefined()
    expect(second).toHaveBeenCalled()
  })

  it('removes handler via off()', async () => {
    const hooks = new HookSystem<TestHooks>()
    const handler = vi.fn()
    hooks.on('bar', handler)
    hooks.off('bar', handler)
    await hooks.emit('bar', { msg: 'hi' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('emits with no handlers does nothing', async () => {
    const hooks = new HookSystem<TestHooks>()
    await expect(hooks.emit('foo', { value: 0 })).resolves.toBeUndefined()
  })
})
