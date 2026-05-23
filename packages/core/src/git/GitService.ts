import { simpleGit, type SimpleGit } from 'simple-git'
import { access, constants } from 'fs/promises'
import path from 'path'

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
}

export class GitService {
  private git: SimpleGit

  constructor(private readonly rootDir: string) {
    this.git = simpleGit(rootDir, {
      config: [
        'user.email=bldmrk@localhost',
        'user.name=bldmrk',
      ],
    })
  }

  async isRepo(): Promise<boolean> {
    try {
      await access(path.join(this.rootDir, '.git'), constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async init(): Promise<void> {
    await this.git.init()
  }

  async commit(message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await this.git.add(files)
    } else {
      await this.git.add('.')
    }

    try {
      const result = await this.git.commit(message)
      // result.commit is the short hash
      return result.commit || await this.getHeadHash()
    } catch (err) {
      // If nothing to commit, still return current HEAD hash
      return await this.getHeadHash()
    }
  }

  private async getHeadHash(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 })
    return log.latest?.hash?.slice(0, 7) ?? ''
  }

  async log(limit = 20): Promise<GitCommit[]> {
    try {
      const result = await this.git.log({ maxCount: limit })
      return result.all.map(entry => ({
        hash: entry.hash,
        message: entry.message,
        author: entry.author_name,
        date: entry.date,
      }))
    } catch {
      return []
    }
  }

  async diff(slug: string): Promise<string> {
    try {
      // Get diff for files related to this slug
      const slugPath = `content/pages/*${slug}*`
      const result = await this.git.diff(['HEAD', '--', slugPath])
      return result
    } catch {
      return ''
    }
  }

  async fileLog(slug: string, limit = 20): Promise<GitCommit[]> {
    try {
      const out = await this.git.raw([
        'log',
        `--max-count=${limit}`,
        '--format=%H\x1f%s\x1f%an\x1f%aI',
        '--',
        `content/pages/*${slug}/index.mdx`,
        `content/pages/*${slug}*/index.mdx`,
      ])
      return out
        .split('\n')
        .filter(line => line.includes('\x1f'))
        .map(line => {
          const [hash, message, author, date] = line.split('\x1f') as [string, string, string, string]
          return { hash, message, author, date }
        })
    } catch {
      return []
    }
  }

  async showFile(hash: string, slug: string): Promise<string> {
    const listing = await this.git.raw(['ls-tree', '-r', '--name-only', hash])
    const filePath = listing
      .split('\n')
      .map(f => f.trim())
      .find(f =>
        f.match(new RegExp(`\\d+--${slug}/index\\.mdx$`)) ||
        f.endsWith(`/${slug}/index.mdx`) ||
        f === `content/pages/${slug}/index.mdx`,
      )
    if (!filePath) {
      throw new Error(`File for slug "${slug}" not found in commit ${hash}`)
    }
    return this.git.show([`${hash}:${filePath}`])
  }

  async restoreFile(hash: string, slug: string): Promise<string> {
    const listing = await this.git.raw(['ls-tree', '-r', '--name-only', hash])
    const filePath = listing
      .split('\n')
      .map(f => f.trim())
      .find(f =>
        f.match(new RegExp(`\\d+--${slug}/index\\.mdx$`)) ||
        f.endsWith(`/${slug}/index.mdx`) ||
        f === `content/pages/${slug}/index.mdx`,
      )
    if (!filePath) {
      throw new Error(`File for slug "${slug}" not found in commit ${hash}`)
    }
    await this.git.checkout([hash, '--', filePath])
    await this.git.add([filePath])
    const result = await this.git.commit(`Restore ${slug} to ${hash.slice(0, 7)}`)
    return result.commit || await this.getHeadHash()
  }

  async status(): Promise<GitStatus> {
    try {
      const result = await this.git.status()
      return {
        modified: result.modified,
        added: [...result.not_added, ...result.created],
        deleted: result.deleted,
      }
    } catch {
      return { modified: [], added: [], deleted: [] }
    }
  }
}
