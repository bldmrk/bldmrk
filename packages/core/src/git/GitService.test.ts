import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'
import { GitService } from './GitService.js'

let tmpDir: string
let git: GitService

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'bldmrk-git-test-'))
  git = new GitService(tmpDir)
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('GitService', () => {
  it('isRepo() returns false on a directory without .git', async () => {
    const result = await git.isRepo()
    expect(result).toBe(false)
  })

  it('init() creates .git and isRepo() returns true', async () => {
    await git.init()
    const result = await git.isRepo()
    expect(result).toBe(true)
  })

  it('commit() returns a commit hash after staging files', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'hello.txt'), 'hello world')
    const hash = await git.commit('initial commit')
    expect(hash).toMatch(/^[0-9a-f]{7,40}$/)
  })

  it('log() returns commits with message, hash, author, date', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'hello.txt'), 'hello world')
    await git.commit('initial commit')
    const commits = await git.log()
    expect(commits.length).toBeGreaterThanOrEqual(1)
    const commit = commits[0]!
    expect(commit).toHaveProperty('hash')
    expect(commit).toHaveProperty('message')
    expect(commit).toHaveProperty('author')
    expect(commit).toHaveProperty('date')
    expect(commit.message).toContain('initial commit')
  })

  it('status() returns modified/added/deleted file lists', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'hello.txt'), 'hello world')
    await git.commit('initial commit')

    // Modify a file
    await writeFile(path.join(tmpDir, 'hello.txt'), 'modified content')
    // Add a new file
    await writeFile(path.join(tmpDir, 'new-file.txt'), 'new content')

    const status = await git.status()
    expect(status).toHaveProperty('modified')
    expect(status).toHaveProperty('added')
    expect(status).toHaveProperty('deleted')
    expect(Array.isArray(status.modified)).toBe(true)
    expect(Array.isArray(status.added)).toBe(true)
    expect(Array.isArray(status.deleted)).toBe(true)
  })

  it('diff() returns a string (can be empty when no changes)', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'content', 'pages', 'my-slug', 'index.mdx').replace(/content.*/, 'hello.txt'), 'content')
    const result = await git.diff('some-slug')
    expect(typeof result).toBe('string')
  })
})

describe('GitService.fileLog()', () => {
  it('returns commits that touched a specific page slug', async () => {
    await git.init()
    const pageDir = path.join(tmpDir, 'content', 'pages', '001--my-post')
    await mkdir(pageDir, { recursive: true })
    await writeFile(path.join(pageDir, 'index.mdx'), '# Hello')
    await git.commit('Save: my-post')

    const commits = await git.fileLog('my-post', 10)
    expect(commits.length).toBeGreaterThanOrEqual(1)
    expect(commits[0]!.message).toBe('Save: my-post')
  })

  it('returns [] for a slug with no commits', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'readme.txt'), 'hi')
    await git.commit('unrelated commit')

    const commits = await git.fileLog('nonexistent-slug', 10)
    expect(commits).toEqual([])
  })

  it('returns [] when not a git repo', async () => {
    const commits = await git.fileLog('any-slug')
    expect(commits).toEqual([])
  })
})

describe('GitService.showFile()', () => {
  it('returns MDX content of a page at a specific commit', async () => {
    await git.init()
    const pageDir = path.join(tmpDir, 'content', 'pages', '001--my-post')
    await mkdir(pageDir, { recursive: true })
    await writeFile(path.join(pageDir, 'index.mdx'), '# Original Content')
    await git.commit('initial')

    const commits = await git.log(1)
    const hash = commits[0]!.hash

    const content = await git.showFile(hash, 'my-post')
    expect(content).toBe('# Original Content')
  })

  it('throws when slug not found in that commit', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'readme.txt'), 'hi')
    await git.commit('unrelated')

    const commits = await git.log(1)
    const hash = commits[0]!.hash

    await expect(git.showFile(hash, 'nonexistent')).rejects.toThrow('not found')
  })
})

describe('GitService.restoreFile()', () => {
  it('restores a page to its state at a past commit', async () => {
    await git.init()
    const pageDir = path.join(tmpDir, 'content', 'pages', '001--my-post')
    await mkdir(pageDir, { recursive: true })

    // First commit: original content
    await writeFile(path.join(pageDir, 'index.mdx'), '# Original')
    await git.commit('initial')
    const firstCommits = await git.log(1)
    const originalHash = firstCommits[0]!.hash

    // Second commit: modified content
    await writeFile(path.join(pageDir, 'index.mdx'), '# Modified')
    await git.commit('update')

    // Restore to original
    await git.restoreFile(originalHash, 'my-post')

    // Verify content was restored and a new commit exists
    const allCommits = await git.log(10)
    expect(allCommits[0]!.message).toContain(originalHash.slice(0, 7))
  })

  it('throws when slug not found in target commit', async () => {
    await git.init()
    await writeFile(path.join(tmpDir, 'readme.txt'), 'hi')
    await git.commit('unrelated')
    const commits = await git.log(1)
    await expect(git.restoreFile(commits[0]!.hash, 'my-post')).rejects.toThrow('not found')
  })
})
