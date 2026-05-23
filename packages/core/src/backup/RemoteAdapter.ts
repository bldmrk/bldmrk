export interface RemoteAdapter {
  upload(localPath: string, remoteName: string): Promise<void>
  delete(remoteName: string): Promise<void>
  list(): Promise<string[]>
}
