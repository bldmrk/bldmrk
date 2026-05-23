import path from 'path'
import { readFile, writeFile } from 'fs/promises'
import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { ConfigLoader } from '../../config/ConfigLoader.js'
import type { BuildQueue } from '../../build/BuildQueue.js'

interface DeployRouteOptions {
  configDir: string
  buildQueue: BuildQueue
  authPreHandler: preHandlerHookHandler
}

interface DeployEntry {
  triggeredAt: string
  success: boolean
  error: string | null
}

interface DeployProviderState {
  latest: DeployEntry | null
  history: DeployEntry[]
}

class DeployStateStore {
  private statePath: string
  private state: Record<string, DeployProviderState> = {}

  constructor(configDir: string) {
    this.statePath = path.join(configDir, '.deploy-state.json')
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.statePath, 'utf-8')
      this.state = JSON.parse(raw) as Record<string, DeployProviderState>
    } catch {
      // File doesn't exist yet, start fresh
    }
  }

  async record(provider: string, entry: DeployEntry): Promise<void> {
    const current = this.state[provider] ?? { latest: null, history: [] }
    current.latest = entry
    current.history = [entry, ...current.history].slice(0, 10)
    this.state[provider] = current
    await this.save()
  }

  get(provider: string): DeployProviderState {
    return this.state[provider] ?? { latest: null, history: [] }
  }

  private async save(): Promise<void> {
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2))
  }
}

async function triggerWebhook(url: string, timeoutMs: number): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal })
    if (!res.ok) throw new Error(`Webhook responded with ${res.status}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function registerDeployRoutes(
  app: FastifyInstance,
  { configDir, buildQueue, authPreHandler }: DeployRouteOptions,
): Promise<void> {
  const loader = new ConfigLoader()
  const stateStore = new DeployStateStore(configDir)
  await stateStore.load()

  // POST /api/deploy/netlify
  app.post('/api/deploy/netlify', { preHandler: authPreHandler }, async (_req, reply) => {
    const { system } = await loader.load(configDir)
    const webhookUrl = system.deploy?.netlify?.url

    if (!webhookUrl) {
      return reply.code(503).send({ message: 'Netlify deploy not configured' })
    }

    buildQueue.enqueue()

    try {
      await triggerWebhook(webhookUrl, system.deploy?.webhookTimeoutMs ?? 10_000)
      await stateStore.record('netlify', { triggeredAt: new Date().toISOString(), success: true, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stateStore.record('netlify', { triggeredAt: new Date().toISOString(), success: false, error: message })
    }

    return reply.send({ triggered: true, provider: 'netlify' })
  })

  // POST /api/deploy/vercel
  app.post('/api/deploy/vercel', { preHandler: authPreHandler }, async (_req, reply) => {
    const { system } = await loader.load(configDir)
    const webhookUrl = system.deploy?.vercel?.url

    if (!webhookUrl) {
      return reply.code(503).send({ message: 'Vercel deploy not configured' })
    }

    buildQueue.enqueue()

    try {
      await triggerWebhook(webhookUrl, system.deploy?.webhookTimeoutMs ?? 10_000)
      await stateStore.record('vercel', { triggeredAt: new Date().toISOString(), success: true, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stateStore.record('vercel', { triggeredAt: new Date().toISOString(), success: false, error: message })
    }

    return reply.send({ triggered: true, provider: 'vercel' })
  })

  // GET /api/deploy/status
  app.get('/api/deploy/status', { preHandler: authPreHandler }, async (_req, reply) => {
    return reply.send({
      netlify: stateStore.get('netlify'),
      vercel: stateStore.get('vercel'),
    })
  })
}
