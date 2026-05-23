import { spawn, type ChildProcess } from 'child_process'

export class Preview {
  private proc: ChildProcess | null = null

  async startPreviewServer(projectDir: string, port: number): Promise<void> {
    this.proc = spawn('pnpm', ['exec', 'astro', 'preview', '--port', String(port)], {
      cwd: projectDir,
      stdio: 'inherit',
    })
    // Astro preview has no "ready" signal — wait for the process to bind the port
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
  }
}
