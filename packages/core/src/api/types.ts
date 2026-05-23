import type { JwtPayload } from '../users/types.js'
import type { BuildQueue } from '../build/BuildQueue.js'
import type { CacheStore } from '../cache/CacheStore.js'

export interface AppConfig {
  contentDir: string
  configDir: string
  port: number
  jwtSecret: string
  corsOrigins?: string[]
  buildQueue?: BuildQueue
  projectDir?: string
  /** Override the default cache store (useful for testing or custom providers) */
  cacheStore?: CacheStore
  multisite?: {
    enabled: boolean
    configPath: string  // path to bldmrk.config.yaml
  }
  /** Fastify logger config. `false` disables logging (default for tests). */
  logger?: boolean | object
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
    siteContext?: import('../multisite/SiteContext.js').SiteContext
  }
}
