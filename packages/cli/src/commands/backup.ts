import { defineCommand } from 'citty'
import { select, confirm } from '@inquirer/prompts'
import { consola } from 'consola'
import path from 'path'
import { BackupService } from '@bldmrk/core'

function getProjectDir(): string {
  return process.cwd()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getBackupService(): BackupService {
  return new BackupService({ projectDir: getProjectDir() })
}

export const backupCreateCommand = defineCommand({
  meta: { description: 'Create a new backup' },
  args: {
    type: {
      type: 'string',
      description: 'Backup type: content or full',
      default: 'content',
    },
  },
  async run({ args }) {
    const type = (args.type === 'full' ? 'full' : 'content') as 'content' | 'full'
    consola.start(`Creating ${type} backup...`)

    const service = getBackupService()
    const meta = await service.createBackup(type)

    consola.success(`Backup created: ${meta.id}`)
    consola.info(`Size: ${formatSize(meta.sizeBytes)}`)
    consola.info(`Path: ${path.join(getProjectDir(), 'backups', meta.id + '.zip')}`)
  },
})

export const backupListCommand = defineCommand({
  meta: { description: 'List all backups' },
  async run() {
    const service = getBackupService()
    const backups = await service.listBackups()

    if (backups.length === 0) {
      consola.info('No backups found.')
      return
    }

    console.log('\n  ID'.padEnd(60) + 'Type'.padEnd(12) + 'Size'.padEnd(12) + 'Created')
    console.log('  ' + '-'.repeat(95))
    for (const b of backups) {
      console.log([
        ('  ' + b.id).padEnd(60),
        b.type.padEnd(12),
        formatSize(b.sizeBytes).padEnd(12),
        b.createdAt.toLocaleString(),
      ].join(''))
    }
    console.log()
  },
})

export const backupRestoreCommand = defineCommand({
  meta: { description: 'Restore a backup by ID' },
  args: {
    id: {
      type: 'positional',
      description: 'Backup ID to restore',
      required: false,
    },
  },
  async run({ args }) {
    const service = getBackupService()

    let id = args.id
    if (!id) {
      const backups = await service.listBackups()
      if (backups.length === 0) {
        consola.warn('No backups available.')
        return
      }
      id = await select({
        message: 'Select backup to restore:',
        choices: backups.map((b: { id: string; type: string; sizeBytes: number; createdAt: Date }) => ({
          value: b.id,
          name: `${b.id} (${b.type}, ${formatSize(b.sizeBytes)}, ${b.createdAt.toLocaleString()})`,
        })),
      })
    }

    const ok = await confirm({
      message: `Restore backup "${id}"? The site will be briefly offline.`,
      default: false,
    })

    if (!ok) {
      consola.info('Restore cancelled.')
      return
    }

    consola.start('Restoring backup...')
    await service.restoreBackup(id)
    consola.success('Backup restored successfully.')
  },
})

export const backupDeleteCommand = defineCommand({
  meta: { description: 'Delete a backup by ID' },
  args: {
    id: {
      type: 'positional',
      description: 'Backup ID to delete',
      required: true,
    },
  },
  async run({ args }) {
    const service = getBackupService()
    await service.deleteBackup(args.id)
    consola.success(`Backup deleted: ${args.id}`)
  },
})
