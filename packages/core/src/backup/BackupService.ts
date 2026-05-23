import path from 'path'
import fs from 'fs/promises'
import { createWriteStream, createReadStream } from 'fs'
import archiver from 'archiver'
import unzipper from 'unzipper'
import type { RemoteAdapter } from './RemoteAdapter.js'

export interface RestoreState {
  backupId: string
  status: 'pending' | 'in-progress' | 'done' | 'failed'
  startedAt: string
  completedAt?: string
  error?: string
}

export interface BackupMeta {
  id: string
  type: 'content' | 'full'
  createdAt: Date
  sizeBytes: number
  remote?: { provider: string; uploaded: boolean }
}

const EXCLUDED_FULL = ['node_modules', 'dist', '.git', 'backups']

export interface BackupServiceOptions {
  projectDir: string
  backupsDir?: string
  remoteAdapter?: RemoteAdapter
  remoteProvider?: string
  stopWatcher?: () => void
  startWatcher?: () => void
}

export class BackupService {
  private projectDir: string
  private backupsDir: string
  private remoteAdapter?: RemoteAdapter
  private remoteProvider?: string
  private stopWatcher?: () => void
  private startWatcher?: () => void
  private restoreStates = new Map<string, RestoreState>()

  constructor(options: BackupServiceOptions) {
    this.projectDir = options.projectDir
    this.backupsDir = options.backupsDir ?? path.join(options.projectDir, 'backups')
    this.remoteAdapter = options.remoteAdapter
    this.remoteProvider = options.remoteProvider
    this.stopWatcher = options.stopWatcher
    this.startWatcher = options.startWatcher
  }

  async createBackup(type: 'content' | 'full'): Promise<BackupMeta> {
    await fs.mkdir(this.backupsDir, { recursive: true })

    const isoDate = new Date().toISOString().replace(/[:.]/g, '-')
    const id = `bldmrk-backup-${type}-${isoDate}`
    const zipPath = path.join(this.backupsDir, `${id}.zip`)

    await this.createZip(type, zipPath)

    const stat = await fs.stat(zipPath)

    let remote: BackupMeta['remote']
    if (this.remoteAdapter && this.remoteProvider) {
      try {
        await this.remoteAdapter.upload(zipPath, `${id}.zip`)
        remote = { provider: this.remoteProvider, uploaded: true }
      } catch {
        remote = { provider: this.remoteProvider, uploaded: false }
      }
    }

    return {
      id,
      type,
      createdAt: stat.birthtime,
      sizeBytes: stat.size,
      remote,
    }
  }

  private createZip(type: 'content' | 'full', outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)

      if (type === 'content') {
        const contentDir = path.join(this.projectDir, 'content')
        archive.directory(contentDir, 'content')

        const usersYaml = path.join(this.projectDir, 'users.yaml')
        archive.file(usersYaml, { name: 'users.yaml' })
      } else {
        archive.glob('**/*', {
          cwd: this.projectDir,
          ignore: EXCLUDED_FULL.map(d => `${d}/**`).concat(EXCLUDED_FULL),
          dot: true,
        })
      }

      void archive.finalize()
    })
  }

  getRestoreState(backupId: string): RestoreState | null {
    return this.restoreStates.get(backupId) ?? null
  }

  async restoreBackup(id: string): Promise<void> {
    const zipPath = path.join(this.backupsDir, `${id}.zip`)
    await fs.access(zipPath)

    const startedAt = new Date().toISOString()
    this.restoreStates.set(id, { backupId: id, status: 'in-progress', startedAt })

    this.stopWatcher?.()

    try {
      await new Promise<void>((resolve, reject) => {
        const extract = unzipper.Extract({ path: this.projectDir })
        const readStream = createReadStream(zipPath)
        readStream.pipe(extract)
        extract.on('close', resolve)
        extract.on('error', reject)
        readStream.on('error', reject)
      })
      this.restoreStates.set(id, { backupId: id, status: 'done', startedAt, completedAt: new Date().toISOString() })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      this.restoreStates.set(id, { backupId: id, status: 'failed', startedAt, completedAt: new Date().toISOString(), error })
      throw err
    } finally {
      this.startWatcher?.()
    }
  }

  async listBackups(): Promise<BackupMeta[]> {
    try {
      await fs.mkdir(this.backupsDir, { recursive: true })
      const entries = await fs.readdir(this.backupsDir)
      const metas: BackupMeta[] = []

      for (const entry of entries) {
        if (!entry.endsWith('.zip')) continue
        const match = /^bldmrk-backup-(content|full)-(.+)\.zip$/.exec(entry)
        if (!match) continue

        const type = match[1] as 'content' | 'full'
        const filePath = path.join(this.backupsDir, entry)
        const stat = await fs.stat(filePath)
        const id = entry.slice(0, -4)

        metas.push({
          id,
          type,
          createdAt: stat.birthtime,
          sizeBytes: stat.size,
        })
      }

      return metas.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch {
      return []
    }
  }

  async deleteBackup(id: string): Promise<void> {
    const zipPath = path.join(this.backupsDir, `${id}.zip`)
    await fs.unlink(zipPath)

    if (this.remoteAdapter) {
      try {
        await this.remoteAdapter.delete(`${id}.zip`)
      } catch {
        // Remote deletion is best-effort
      }
    }
  }

  async pruneOldBackups(max: number): Promise<void> {
    const backups = await this.listBackups()
    if (backups.length <= max) return

    const toDelete = backups.slice(max)
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id)
    }
  }

  getBackupPath(id: string): string {
    return path.join(this.backupsDir, `${id}.zip`)
  }
}
