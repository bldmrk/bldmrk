import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input, _tag: 'Put' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input, _tag: 'Delete' })),
  ListObjectsV2Command: vi.fn().mockImplementation((input) => ({ input, _tag: 'List' })),
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    default: {
      ...(actual as Record<string, unknown>),
      createReadStream: vi.fn().mockReturnValue('stream'),
    },
    createReadStream: vi.fn().mockReturnValue('stream'),
  }
})

import { S3Adapter } from './S3Adapter.js'

const config = {
  bucket: 'test-bucket',
  region: 'us-east-1',
  accessKeyId: 'AKID',
  secretAccessKey: 'secret',
}

describe('S3Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({})
  })

  it('uploads a file with PutObjectCommand', async () => {
    const adapter = new S3Adapter(config)
    await adapter.upload('/local/backup.zip', 'backup.zip')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call._tag).toBe('Put')
    expect(call.input.Bucket).toBe('test-bucket')
    expect(call.input.Key).toBe('backup.zip')
  })

  it('deletes a file with DeleteObjectCommand', async () => {
    const adapter = new S3Adapter(config)
    await adapter.delete('backup.zip')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call._tag).toBe('Delete')
    expect(call.input.Key).toBe('backup.zip')
  })

  it('lists files with ListObjectsV2Command', async () => {
    mockSend.mockResolvedValue({
      Contents: [{ Key: 'backup1.zip' }, { Key: 'backup2.zip' }],
    })
    const adapter = new S3Adapter(config)
    const files = await adapter.list()

    expect(files).toEqual(['backup1.zip', 'backup2.zip'])
  })

  it('returns empty array when no Contents in list response', async () => {
    mockSend.mockResolvedValue({})
    const adapter = new S3Adapter(config)
    const files = await adapter.list()
    expect(files).toEqual([])
  })

  it('uses custom endpoint when provided', async () => {
    const { S3Client } = await import('@aws-sdk/client-s3')
    const S3ClientMock = S3Client as ReturnType<typeof vi.fn>

    new S3Adapter({ ...config, endpoint: 'http://localhost:9000' })

    const ctorCall = S3ClientMock.mock.calls[S3ClientMock.mock.calls.length - 1][0]
    expect(ctorCall.endpoint).toBe('http://localhost:9000')
  })
})
