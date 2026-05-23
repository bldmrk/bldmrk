import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAccess = vi.fn()
const mockEnsureDir = vi.fn()
const mockUploadFrom = vi.fn()
const mockRemove = vi.fn()
const mockList = vi.fn()
const mockClose = vi.fn()

vi.mock('basic-ftp', () => ({
  Client: vi.fn().mockImplementation(() => ({
    access: mockAccess,
    ensureDir: mockEnsureDir,
    uploadFrom: mockUploadFrom,
    remove: mockRemove,
    list: mockList,
    close: mockClose,
  })),
}))

import { FtpAdapter } from './FtpAdapter.js'

const config = {
  host: 'ftp.example.com',
  user: 'ftpuser',
  password: 'secret',
}

describe('FtpAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccess.mockResolvedValue(undefined)
    mockEnsureDir.mockResolvedValue(undefined)
    mockUploadFrom.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
    mockClose.mockReturnValue(undefined)
  })

  it('connects and uploads a file', async () => {
    const adapter = new FtpAdapter(config)
    await adapter.upload('/local/backup.zip', 'backup.zip')

    expect(mockAccess).toHaveBeenCalledWith({
      host: 'ftp.example.com',
      port: 21,
      user: 'ftpuser',
      password: 'secret',
      secure: false,
    })
    expect(mockEnsureDir).toHaveBeenCalledWith('/backups')
    expect(mockUploadFrom).toHaveBeenCalledWith('/local/backup.zip', '/backups/backup.zip')
    expect(mockClose).toHaveBeenCalled()
  })

  it('connects and deletes a file', async () => {
    const adapter = new FtpAdapter(config)
    await adapter.delete('backup.zip')

    expect(mockRemove).toHaveBeenCalledWith('/backups/backup.zip')
    expect(mockClose).toHaveBeenCalled()
  })

  it('lists remote files', async () => {
    mockList.mockResolvedValue([{ name: 'backup1.zip' }, { name: 'backup2.zip' }])
    const adapter = new FtpAdapter(config)
    const files = await adapter.list()

    expect(files).toEqual(['backup1.zip', 'backup2.zip'])
    expect(mockClose).toHaveBeenCalled()
  })

  it('closes client even when operation fails', async () => {
    mockUploadFrom.mockRejectedValue(new Error('connection refused'))
    const adapter = new FtpAdapter(config)

    await expect(adapter.upload('/local/backup.zip', 'backup.zip')).rejects.toThrow('connection refused')
    expect(mockClose).toHaveBeenCalled()
  })

  it('uses custom port and remotePath', async () => {
    const adapter = new FtpAdapter({ ...config, port: 2121, remotePath: '/mybackups', secure: true })
    await adapter.upload('/local/file.zip', 'file.zip')

    expect(mockAccess).toHaveBeenCalledWith(
      expect.objectContaining({ port: 2121, secure: true }),
    )
    expect(mockEnsureDir).toHaveBeenCalledWith('/mybackups')
    expect(mockUploadFrom).toHaveBeenCalledWith('/local/file.zip', '/mybackups/file.zip')
  })
})
