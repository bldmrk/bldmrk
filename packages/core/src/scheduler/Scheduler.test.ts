import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Scheduler } from './Scheduler.js'

describe('Scheduler', () => {
  let scheduler: Scheduler

  beforeEach(() => {
    scheduler = new Scheduler()
  })

  afterEach(() => {
    scheduler.stopAll()
    vi.useRealTimers()
  })

  it('executes a job after its scheduled time using fake timers', async () => {
    vi.useFakeTimers()
    const calls: number[] = []

    scheduler.addJob({
      name: 'test-job',
      schedule: '* * * * * *', // every second
      handler: async () => {
        calls.push(Date.now())
      },
    })

    // Advance 1.1 seconds — node-cron should fire once
    await vi.advanceTimersByTimeAsync(1100)

    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  it('stores handler error in history and continues scheduling', async () => {
    vi.useFakeTimers()
    let callCount = 0

    const id = scheduler.addJob({
      name: 'error-job',
      schedule: '* * * * * *',
      handler: async () => {
        callCount++
        throw new Error('intentional failure')
      },
    })

    await vi.advanceTimersByTimeAsync(1100)

    const history = scheduler.getHistory(id)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0]!.status).toBe('error')
    expect(history[0]!.error).toBe('intentional failure')

    // Advance more time — job should still be scheduled
    await vi.advanceTimersByTimeAsync(1100)
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  it('removeJob stops the job from running', async () => {
    vi.useFakeTimers()
    let callCount = 0

    const id = scheduler.addJob({
      name: 'removable-job',
      schedule: '* * * * * *',
      handler: async () => {
        callCount++
      },
    })

    await vi.advanceTimersByTimeAsync(1100)
    const countBeforeRemove = callCount

    scheduler.removeJob(id)

    await vi.advanceTimersByTimeAsync(2000)
    expect(callCount).toBe(countBeforeRemove)

    // Job no longer in getAll()
    expect(scheduler.getAll().find(j => j.id === id)).toBeUndefined()
  })

  it('getAll returns all registered jobs', () => {
    const id1 = scheduler.addJob({
      name: 'job-1',
      schedule: '* * * * *',
      handler: async () => {},
    })
    const id2 = scheduler.addJob({
      name: 'job-2',
      schedule: '* * * * *',
      handler: async () => {},
    })

    const all = scheduler.getAll()
    expect(all).toHaveLength(2)
    expect(all.map(j => j.id)).toContain(id1)
    expect(all.map(j => j.id)).toContain(id2)
  })

  it('getHistory returns empty array for unknown id', () => {
    expect(scheduler.getHistory('nonexistent')).toEqual([])
  })

  it('records success status in history', async () => {
    vi.useFakeTimers()

    const id = scheduler.addJob({
      name: 'success-job',
      schedule: '* * * * * *',
      handler: async () => {},
    })

    await vi.advanceTimersByTimeAsync(1100)

    const history = scheduler.getHistory(id)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0]!.status).toBe('success')
    expect(history[0]!.durationMs).toBeGreaterThanOrEqual(0)
  })
})
