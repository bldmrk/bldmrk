import type { BuildResult } from './BuildTrigger.js'

export type BuildStatus = 'idle' | 'queued' | 'building' | 'done' | 'error'

export interface StatusUpdate {
  status: BuildStatus
  log?: string
  duration?: number
}

type TriggerFn = (projectDir: string) => { lines: AsyncGenerator<string>; result: Promise<BuildResult> }

export class BuildQueue {
  private status: BuildStatus = 'idle'
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingAfterBuild = false
  private subscribers: ((update: StatusUpdate) => void)[] = []
  private history: BuildResult[] = []

  constructor(
    private triggerFn: TriggerFn,
    private projectDir: string,
  ) {}

  enqueue(): void {
    if (this.status === 'building') {
      this.pendingAfterBuild = true
      return
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.setStatus('queued')
    this.debounceTimer = setTimeout(() => { void this.runBuild() }, 500)
  }

  getStatus(): BuildStatus {
    return this.status
  }

  onStatusChange(cb: (update: StatusUpdate) => void): () => void {
    this.subscribers.push(cb)
    return () => { this.subscribers = this.subscribers.filter((s) => s !== cb) }
  }

  getHistory(): BuildResult[] {
    return [...this.history]
  }

  private setStatus(status: BuildStatus, log?: string, duration?: number): void {
    this.status = status
    const update: StatusUpdate = {
      status,
      ...(log !== undefined && { log }),
      ...(duration !== undefined && { duration }),
    }
    for (const cb of this.subscribers) cb(update)
  }

  private async runBuild(): Promise<void> {
    this.debounceTimer = null
    this.setStatus('building')
    try {
      const { lines, result } = this.triggerFn(this.projectDir)
      for await (const line of lines) {
        this.setStatus('building', line)
      }
      const buildResult = await result
      this.history.unshift(buildResult)
      if (this.history.length > 10) this.history.pop()
      this.setStatus(buildResult.success ? 'done' : 'error', undefined, buildResult.duration)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStatus('error', message)
    } finally {
      if (this.pendingAfterBuild) {
        this.pendingAfterBuild = false
        this.enqueue()
      }
    }
  }
}
