import { Client } from 'basic-ftp'
import type { RemoteAdapter } from '../RemoteAdapter.js'

export interface FtpConfig {
  host: string
  port?: number
  user: string
  password: string
  secure?: boolean
  remotePath?: string
}

export class FtpAdapter implements RemoteAdapter {
  private config: Required<FtpConfig>

  constructor(config: FtpConfig) {
    this.config = {
      port: 21,
      secure: false,
      remotePath: '/backups',
      ...config,
    }
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client()
    try {
      await client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure,
      })
      return await fn(client)
    } finally {
      client.close()
    }
  }

  async upload(localPath: string, remoteName: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.ensureDir(this.config.remotePath)
      await client.uploadFrom(localPath, `${this.config.remotePath}/${remoteName}`)
    })
  }

  async delete(remoteName: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.remove(`${this.config.remotePath}/${remoteName}`)
    })
  }

  async list(): Promise<string[]> {
    return this.withClient(async (client) => {
      const files = await client.list(this.config.remotePath)
      return files.map(f => f.name)
    })
  }
}
