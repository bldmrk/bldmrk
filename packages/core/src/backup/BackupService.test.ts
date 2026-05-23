import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// We mock archiver, unzipper and fs/promises to avoid real disk I/O
vi.mock('archiver', () => {
  const archive = {
    directory: vi.fn(),
    file: vi.fn(),
    glob: vi.fn(),
    pipe: vi.fn(),
    finalize: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'error') {
        // no-op: we don't emit errors in happy-path
      }
      return archive
    }),
  }
  return {
    default: vi.fn(() => archive),
    __archive: archive,
  }
})

vi.mock('unzipper', () => ({
  default: {
    Extract: vi.fn(() => {
      const stream = {
        on: vi.fn((event: string, cb: () => void) => {
          if (event === 'close') setTimeout(cb, 0)
          return stream
        }),
      }
      return stream
    }),
  },
}))

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close') setTimeout(cb, 0)
    }),
  })),
  createReadStream: vi.fn(() => ({
    pipe: vi.fn(),
    on: vi.fn(),
  })),
}))

const mockStat = vi.fn()
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockReaddir = vi.fn()
const mockUnlink = vi.fn().mockResolvedValue(undefined)
const mockAccess = vi.fn().mockResolvedValue(undefined)

vi.mock('fs/promises', () => ({
  default: {
    stat: (...args: unknown[]) => mockStat(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    access: (...args: unknown[]) => mockAccess(...args),
  },
}))

import { BackupService } from './BackupService.js'

const PROJECT_DIR = '/project'
const BACKUPS_DIR = '/project/backups'

function makeService(opts: Partial<ConstructorParameters<typeof BackupService>[0]> = {}) {
  return new BackupService({ projectDir: PROJECT_DIR, ...opts })
}

function makeStatResult(size = 1024, birthtimeMs = Date.now()) {
  return { size, birthtime: new Date(birthtimeMs) }
}

describe('BackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStat.mockResolvedValue(makeStatResult())
    mockMkdir.mockResolvedValue(undefined)
    mockReaddir.mockResolvedValue([])
    mockUnlink.mockResolvedValue(undefined)
    mockAccess.mockResolvedValue(undefined)
  })

  describe('createBackup(content)', () => {
    it('creates a zip with content dir and users.yaml', async () => {
      const archiverMod = await import('archiver')
      const archiverFn = archiverMod.default as unknown as ReturnType<typeof vi.fn>

      const service = makeService()
      const meta = await service.createBackup('content')

      expect(meta.type).toBe('content')
      expect(meta.id).toMatch(/^bldmrk-backup-content-/)
      expect(meta.sizeBytes).toBe(1024)

      const archive = archiverFn.mock.results[0]?.value
      expect(archive.directory).toHaveBeenCalledWith(
        path.join(PROJECT_DIR, 'content'),
        'content',
      )
      expect(archive.file).toHaveBeenCalledWith(
        path.join(PROJECT_DIR, 'users.yaml'),
        { name: 'users.yaml' },
      )
      expect(archive.glob).not.toHaveBeenCalled()
    })

    it('does not include node_modules in content backup', async () => {
      const archiverMod = await import('archiver')
      const archiverFn = archiverMod.default as unknown as ReturnType<typeof vi.fn>

      const service = makeService()
      await service.createBackup('content')

      const archive = archiverFn.mock.results[0]?.value
      expect(archive.glob).not.toHaveBeenCalled()
    })
  })

  describe('createBackup(full)', () => {
    it('uses glob with exclusions for node_modules, dist, .git, backups', async () => {
      const archiverMod = await import('archiver')
      const archiverFn = archiverMod.default as unknown as ReturnType<typeof vi.fn>

      const service = makeService()
      await service.createBackup('full')

      const archive = archiverFn.mock.results[0]?.value
      expect(archive.glob).toHaveBeenCalled()
      const [, opts] = archive.glob.mock.calls[0]
      const ignore: string[] = opts.ignore
      expect(ignore).toContain('node_modules/**')
      expect(ignore).toContain('dist/**')
      expect(ignore).toContain('.git/**')
      expect(ignore).toContain('backups/**')
    })

    it('returns BackupMeta with type full', async () => {
      const service = makeService()
      const meta = await service.createBackup('full')
      expect(meta.type).toBe('full')
      expect(meta.id).toMatch(/^bldmrk-backup-full-/)
    })
  })

  describe('listBackups()', () => {
    it('returns empty array when no backups exist', async () => {
      mockReaddir.mockResolvedValue([])
      const service = makeService()
      const list = await service.listBackups()
      expect(list).toEqual([])
    })

    it('returns sorted list newest first', async () => {
      const now = Date.now()
      const older = now - 10_000
      const newer = now

      mockReaddir.mockResolvedValue([
        'bldmrk-backup-content-2024-01-01T00-00-00-000Z.zip',
        'bldmrk-backup-full-2024-01-02T00-00-00-000Z.zip',
      ])

      mockStat
        .mockResolvedValueOnce(makeStatResult(500, older))
        .mockResolvedValueOnce(makeStatResult(1000, newer))

      const service = makeService()
      const list = await service.listBackups()

      expect(list).toHaveLength(2)
      expect(list[0].createdAt.getTime()).toBeGreaterThanOrEqual(list[1].createdAt.getTime())
    })

    it('ignores non-zip files', async () => {
      mockReaddir.mockResolvedValue(['readme.txt', 'bldmrk-backup-content-2024-01-01T00-00-00-000Z.zip'])
      mockStat.mockResolvedValue(makeStatResult())

      const service = makeService()
      const list = await service.listBackups()
      expect(list).toHaveLength(1)
    })
  })

  describe('deleteBackup()', () => {
    it('removes the zip file', async () => {
      const service = makeService()
      await service.deleteBackup('bldmrk-backup-content-2024-01-01T00-00-00-000Z')

      expect(mockUnlink).toHaveBeenCalledWith(
        path.join(BACKUPS_DIR, 'bldmrk-backup-content-2024-01-01T00-00-00-000Z.zip'),
      )
    })

    it('calls remoteAdapter.delete when adapter configured', async () => {
      const remoteAdapter = {
        upload: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn(),
      }
      const service = makeService({ remoteAdapter, remoteProvider: 's3' })
      const id = 'bldmrk-backup-content-2024-01-01T00-00-00-000Z'
      await service.deleteBackup(id)

      expect(remoteAdapter.delete).toHaveBeenCalledWith(`${id}.zip`)
    })
  })

  describe('pruneOldBackups()', () => {
    it('deletes oldest backups when over limit', async () => {
      const now = Date.now()
      mockReaddir.mockResolvedValue([
        'bldmrk-backup-content-2024-01-03T00-00-00-000Z.zip',
        'bldmrk-backup-content-2024-01-02T00-00-00-000Z.zip',
        'bldmrk-backup-content-2024-01-01T00-00-00-000Z.zip',
        'bldmrk-backup-content-2024-01-04T00-00-00-000Z.zip',
      ])

      // Return stats in order: newest to oldest (after sort they'll be: 4,3,2,1)
      const times = [now - 2000, now - 3000, now - 4000, now - 1000]
      for (const t of times) {
        mockStat.mockResolvedValueOnce(makeStatResult(1024, t))
      }

      const service = makeService()
      await service.pruneOldBackups(3)

      expect(mockUnlink).toHaveBeenCalledTimes(1)
    })

    it('does nothing when under limit', async () => {
      mockReaddir.mockResolvedValue([
        'bldmrk-backup-content-2024-01-01T00-00-00-000Z.zip',
      ])
      mockStat.mockResolvedValue(makeStatResult())

      const service = makeService()
      await service.pruneOldBackups(3)
      expect(mockUnlink).not.toHaveBeenCalled()
    })
  })

  describe('createBackup with remote upload', () => {
    it('uploads to remote after creating zip', async () => {
      const remoteAdapter = {
        upload: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        list: vi.fn(),
      }
      const service = makeService({ remoteAdapter, remoteProvider: 's3' })
      const meta = await service.createBackup('content')

      expect(remoteAdapter.upload).toHaveBeenCalledTimes(1)
      expect(meta.remote).toEqual({ provider: 's3', uploaded: true })
    })

    it('marks remote as not uploaded when upload fails', async () => {
      const remoteAdapter = {
        upload: vi.fn().mockRejectedValue(new Error('S3 error')),
        delete: vi.fn(),
        list: vi.fn(),
      }
      const service = makeService({ remoteAdapter, remoteProvider: 's3' })
      const meta = await service.createBackup('content')

      expect(meta.remote).toEqual({ provider: 's3', uploaded: false })
    })
  })
})
