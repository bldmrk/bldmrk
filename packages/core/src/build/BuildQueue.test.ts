import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BuildQueue } from './BuildQueue.js'
import type { BuildResult } from './BuildTrigger.js'

function makeMockTrigger(delayMs = 10): {
  trigger: (dir: string) => { lines: AsyncGenerator<string>; result: Promise<BuildResult> }
  callCount: () => number
} {
  let calls = 0
  async function* noLines(): AsyncGenerator<string> { /* empty */ }
  return {
    trigger: (_dir: string) => {
      calls++
      return {
        lines: noLines(),
        result: new Promise<BuildResult>((resolve) =>
          setTimeout(() => resolve({ success: true, duration: delayMs, pages: 1, errors: [] }), delayMs)
        ),
      }
    },
    callCount: () => calls,
  }
}

describe('BuildQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('5 rapid enqueue() calls within 100ms trigger only one build', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')

    for (let i = 0; i < 5; i++) queue.enqueue()
    await vi.advanceTimersByTimeAsync(600) // past debounce
    await vi.advanceTimersByTimeAsync(100) // past build finish

    expect(mock.callCount()).toBe(1)
  })

  it('getStatus() is done after build completes', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(600)
    await vi.advanceTimersByTimeAsync(100)

    expect(queue.getStatus()).toBe('done')
  })

  it('two enqueue() calls 600ms apart trigger two separate builds', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(600)
    await vi.advanceTimersByTimeAsync(100)

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(600)
    await vi.advanceTimersByTimeAsync(100)

    expect(mock.callCount()).toBe(2)
  })

  it('enqueue() during active build schedules one follow-up build', async () => {
    const mock = makeMockTrigger(200)
    const queue = new BuildQueue(mock.trigger, '/project')

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(600) // debounce fires, build starts

    queue.enqueue() // during build → should NOT start a second immediately
    expect(mock.callCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(300) // first build finishes
    await vi.advanceTimersByTimeAsync(600) // second build debounce + start
    await vi.advanceTimersByTimeAsync(300) // second build finishes

    expect(mock.callCount()).toBe(2)
  })

  it('onStatusChange callback receives queued, building, and done events', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')
    const statuses: string[] = []

    const unsub = queue.onStatusChange((u) => statuses.push(u.status))
    queue.enqueue()
    await vi.advanceTimersByTimeAsync(700)
    unsub()

    expect(statuses).toContain('queued')
    expect(statuses).toContain('building')
    expect(statuses).toContain('done')
  })

  it('onStatusChange unsubscribe stops further callbacks', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')
    const statuses: string[] = []

    const unsub = queue.onStatusChange((u) => statuses.push(u.status))
    unsub() // unsubscribe immediately

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(700)

    expect(statuses).toEqual([]) // no callbacks received
  })

  it('getHistory() returns last build result after build completes', async () => {
    const mock = makeMockTrigger(10)
    const queue = new BuildQueue(mock.trigger, '/project')

    queue.enqueue()
    await vi.advanceTimersByTimeAsync(700)

    const history = queue.getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].success).toBe(true)
    expect(history[0].pages).toBe(1)
  })

  it('history is capped at 10 entries', async () => {
    const mock = makeMockTrigger(5)
    const queue = new BuildQueue(mock.trigger, '/project')

    for (let i = 0; i < 12; i++) {
      // Reset status so we can enqueue again (simulate idle between builds)
      // Each enqueue after done is fine since status is 'done' not 'building'
      queue.enqueue()
      await vi.advanceTimersByTimeAsync(600)
      await vi.advanceTimersByTimeAsync(50)
    }

    expect(queue.getHistory()).toHaveLength(10)
  })

  it('getStatus() is error when triggerFn throws', async () => {
    const queue = new BuildQueue(() => { throw new Error('spawn failed') }, '/project')
    const statuses: string[] = []
    queue.onStatusChange((u) => statuses.push(u.status))
    queue.enqueue()
    await vi.advanceTimersByTimeAsync(600)
    expect(queue.getStatus()).toBe('error')
    expect(statuses).toContain('error')
  })
})
