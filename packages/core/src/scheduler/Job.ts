export interface Job {
  id: string
  name: string
  schedule: string // cron expression
  handler: () => Promise<void>
  lastRun?: Date
  lastStatus?: 'success' | 'error'
  lastError?: string
}

export interface JobRun {
  runAt: Date
  status: 'success' | 'error'
  error?: string
  durationMs: number
}
