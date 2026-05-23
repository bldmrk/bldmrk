import cron from 'node-cron'
import { randomUUID } from 'crypto'
import type { Job, JobRun } from './Job.js'

const MAX_HISTORY = 50

interface StoredJob {
  job: Job
  task: cron.ScheduledTask
  history: JobRun[]
}

export class Scheduler {
  private jobs = new Map<string, StoredJob>()

  addJob(jobDef: Omit<Job, 'id' | 'lastRun' | 'lastStatus' | 'lastError'>): string {
    const id = randomUUID()
    const job: Job = { ...jobDef, id }

    const task = cron.schedule(jobDef.schedule, async () => {
      const runAt = new Date()
      const start = Date.now()
      const stored = this.jobs.get(id)
      if (!stored) return

      try {
        await jobDef.handler()
        const run: JobRun = { runAt, status: 'success', durationMs: Date.now() - start }
        stored.job.lastRun = runAt
        stored.job.lastStatus = 'success'
        stored.job.lastError = undefined
        stored.history.push(run)
        if (stored.history.length > MAX_HISTORY) {
          stored.history.splice(0, stored.history.length - MAX_HISTORY)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        const run: JobRun = { runAt, status: 'error', error: errorMsg, durationMs: Date.now() - start }
        stored.job.lastRun = runAt
        stored.job.lastStatus = 'error'
        stored.job.lastError = errorMsg
        stored.history.push(run)
        if (stored.history.length > MAX_HISTORY) {
          stored.history.splice(0, stored.history.length - MAX_HISTORY)
        }
        console.error(`[Scheduler] Job "${job.name}" (${id}) failed:`, errorMsg)
      }
    })

    this.jobs.set(id, { job, task, history: [] })
    return id
  }

  removeJob(id: string): void {
    const stored = this.jobs.get(id)
    if (!stored) return
    stored.task.stop()
    this.jobs.delete(id)
  }

  getHistory(id: string): JobRun[] {
    return this.jobs.get(id)?.history ?? []
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values()).map(s => ({ ...s.job }))
  }

  async runNow(id: string): Promise<void> {
    const stored = this.jobs.get(id)
    if (!stored) throw new Error(`Job not found: ${id}`)

    const runAt = new Date()
    const start = Date.now()

    try {
      await stored.job.handler()
      const run: JobRun = { runAt, status: 'success', durationMs: Date.now() - start }
      stored.job.lastRun = runAt
      stored.job.lastStatus = 'success'
      stored.job.lastError = undefined
      stored.history.push(run)
      if (stored.history.length > MAX_HISTORY) {
        stored.history.splice(0, stored.history.length - MAX_HISTORY)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const run: JobRun = { runAt, status: 'error', error: errorMsg, durationMs: Date.now() - start }
      stored.job.lastRun = runAt
      stored.job.lastStatus = 'error'
      stored.job.lastError = errorMsg
      stored.history.push(run)
      if (stored.history.length > MAX_HISTORY) {
        stored.history.splice(0, stored.history.length - MAX_HISTORY)
      }
      throw err
    }
  }

  stopAll(): void {
    for (const stored of this.jobs.values()) {
      stored.task.stop()
    }
    this.jobs.clear()
  }
}
