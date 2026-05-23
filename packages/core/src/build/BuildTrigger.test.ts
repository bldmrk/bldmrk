import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock child_process before importing BuildTrigger
class MockProc extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
}
const mockProc = new MockProc()

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProc),
}))

const { BuildTrigger } = await import('./BuildTrigger.js')

function emitLines(emitter: EventEmitter, lines: string[]): void {
  emitter.emit('data', Buffer.from(lines.join('\n') + '\n'))
}

beforeEach(() => {
  mockProc.stdout.removeAllListeners()
  mockProc.stderr.removeAllListeners()
  mockProc.removeAllListeners()
})

describe('BuildTrigger', () => {
  it('yields stdout lines from the async generator', async () => {
    const trigger = new BuildTrigger()
    const { lines, result } = trigger.trigger('/project')

    emitLines(mockProc.stdout, ['line 1', 'line 2'])
    mockProc.emit('close', 0)

    const collected: string[] = []
    for await (const line of lines) collected.push(line)

    expect(collected).toContain('line 1')
    expect(collected).toContain('line 2')
  })

  it('resolves result with success=true when exit code is 0', async () => {
    const trigger = new BuildTrigger()
    const { lines, result } = trigger.trigger('/project')

    emitLines(mockProc.stdout, ['3 pages built in 1.2s'])
    mockProc.emit('close', 0)

    for await (const _ of lines) { /* drain */ }
    const r = await result

    expect(r.success).toBe(true)
    expect(r.pages).toBe(3)
    expect(r.errors).toEqual([])
  })

  it('resolves result with success=false and errors when exit code is non-zero', async () => {
    const trigger = new BuildTrigger()
    const { lines, result } = trigger.trigger('/project')

    emitLines(mockProc.stderr, ['Build failed: missing module'])
    mockProc.emit('close', 1)

    for await (const _ of lines) { /* drain */ }
    const r = await result

    expect(r.success).toBe(false)
    expect(r.errors).toContain('Build failed: missing module')
  })

  it('collects stderr lines in errors even on successful build (warnings)', async () => {
    const trigger = new BuildTrigger()
    const { lines, result } = trigger.trigger('/project')

    emitLines(mockProc.stderr, ['Deprecation warning: foo'])
    emitLines(mockProc.stdout, ['1 page built'])
    mockProc.emit('close', 0)

    for await (const _ of lines) { /* drain */ }
    const r = await result

    expect(r.success).toBe(true)
    expect(r.errors).toContain('Deprecation warning: foo')
  })

  it('does not yield empty lines', async () => {
    const trigger = new BuildTrigger()
    const { lines, result } = trigger.trigger('/project')

    mockProc.stdout.emit('data', Buffer.from('\n\n  \nreal line\n'))
    mockProc.emit('close', 0)

    const collected: string[] = []
    for await (const line of lines) collected.push(line)

    expect(collected).not.toContain('')
    expect(collected).not.toContain('  ')
    expect(collected).toContain('real line')
  })
})
