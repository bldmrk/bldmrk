import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import fs from 'fs'
import type { RemoteAdapter } from '../RemoteAdapter.js'

export interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
}

export class S3Adapter implements RemoteAdapter {
  private client: S3Client
  private bucket: string

  constructor(config: S3Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    })
  }

  async upload(localPath: string, remoteName: string): Promise<void> {
    const stream = fs.createReadStream(localPath)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: remoteName,
        Body: stream,
        ContentType: 'application/zip',
      }),
    )
  }

  async delete(remoteName: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: remoteName,
      }),
    )
  }

  async list(): Promise<string[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket }),
    )
    return (response.Contents ?? []).map(obj => obj.Key ?? '').filter(Boolean)
  }
}
