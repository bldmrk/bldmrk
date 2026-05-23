import { spawn } from 'child_process'

export interface BuildResult {
  success: boolean
  duration: number
  pages: number
  errors: string[]
}

export class BuildTrigger {
  trigger(projectDir: string): {
    lines: AsyncGenerator<string>
    result: Promise<BuildResult>
  } {
    const start = Date.now()
    const errors: string[] = []
    const allLines: string[] = [] // never shifted — used for final analysis
    const lineQueue: string[] = [] // shifted by generator consumer
    let notifyResolver: (() => void) | null = null
    let procDone = false

    let resolveDone!: (r: BuildResult) => void
    const result = new Promise<BuildResult>((resolve) => { resolveDone = resolve })

    let resolveProc!: () => void
    const procDonePromise = new Promise<void>((resolve) => { resolveProc = resolve })

    const proc = spawn('pnpm', ['exec', 'astro', 'build'], {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    function pushLine(line: string): void {
      if (!line.trim()) return
      allLines.push(line)
      lineQueue.push(line)
      notifyResolver?.()
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) pushLine(line)
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) errors.push(line)
        pushLine(line)
      }
    })

    proc.on('close', (code) => {
      const duration = Date.now() - start
      const pagesMatch = allLines.join('\n').match(/(\d+) pages? built/i)
      resolveDone({
        success: code === 0,
        duration,
        pages: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
        errors,
      })
      procDone = true
      notifyResolver?.()
      resolveProc()
    })

    async function* lines(): AsyncGenerator<string> {
      while (true) {
        while (lineQueue.length) yield lineQueue.shift()!
        if (procDone) break
        // procDonePromise.then(r) is the safety valve for the race where procDone
        // flips to true between the loop guard check and this await
        await new Promise<void>((r) => {
          notifyResolver = () => { notifyResolver = null; r() }
          procDonePromise.then(r)
        })
      }
      while (lineQueue.length) yield lineQueue.shift()!
    }

    return { lines: lines(), result }
  }
}
