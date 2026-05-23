import { z } from 'zod'

export const SiteConfigSchema = z.object({
  name: z.string().default('My bldmrk Site'),
  description: z.string().optional(),
  url: z.string().default('http://localhost:3000'),
  author: z.string().optional(),
  social: z.record(z.string(), z.string()).optional(),
})

export const SystemConfigSchema = z.object({
  port: z.number().int().default(3000),
  adminPath: z.string().default('/admin'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().default(60),
    maxSize: z.number().int().default(500),
    provider: z.enum(['memory', 'redis']).default('memory'),
    redis: z.object({
      host: z.string().default('localhost'),
      port: z.number().default(6379),
      password: z.string().optional(),
      db: z.number().default(0),
      keyPrefix: z.string().default('bldmrk:'),
    }).optional(),
  }).default({ enabled: true, ttl: 60, maxSize: 500, provider: 'memory' as const }),
  cors: z.object({
    origins: z.array(z.string()).default([]),
  }).default({ origins: [] }),
  deploy: z.object({
    netlify: z.object({ url: z.string().url() }).optional(),
    vercel: z.object({ url: z.string().url() }).optional(),
    webhookTimeoutMs: z.number().int().positive().default(10_000),
  }).optional(),
  smtp: z.object({
    host: z.string(),
    port: z.number().default(587),
    secure: z.boolean().default(false),
    auth: z.object({ user: z.string(), pass: z.string() }).optional(),
    from: z.string().email().optional(),
  }).optional(),
  git: z.object({
    autoCommit: z.boolean().default(false),
  }).default({ autoCommit: false }),
  backup: z.object({
    schedule: z.string().optional(),
    maxBackups: z.number().int().default(10),
    type: z.enum(['content', 'full']).default('content'),
    remote: z.object({
      provider: z.enum(['s3', 'ftp']),
      s3: z.object({
        bucket: z.string(),
        region: z.string(),
        accessKeyId: z.string(),
        secretAccessKey: z.string(),
        endpoint: z.string().optional(),
      }).optional(),
      ftp: z.object({
        host: z.string(),
        port: z.number().default(21),
        user: z.string(),
        password: z.string(),
        secure: z.boolean().default(false),
        remotePath: z.string().default('/backups'),
      }).optional(),
    }).optional(),
  }).optional(),
})

export type SiteConfig = z.infer<typeof SiteConfigSchema>
export type SystemConfig = z.infer<typeof SystemConfigSchema>
