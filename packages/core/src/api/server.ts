import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import path from 'path'
import { UserStore } from '../users/UserStore.js'
import { AuthService } from '../users/AuthService.js'
import { PermissionSystem } from '../users/PermissionSystem.js'
import { PageLoader } from '../content/PageLoader.js'
import { buildAuthMiddleware } from './middleware/auth.js'
import { registerCachePlugin, registerCacheSendHook, makeCacheHandler } from './middleware/cache.js'
import { registerUserRoutes } from './routes/users.js'
import { registerPageRoutes } from './routes/pages.js'
import { registerMediaRoutes } from './routes/media.js'
import { registerBuildRoutes } from './routes/build.js'
import { registerConfigRoutes } from './routes/config.js'
import { registerPluginRoutes } from './routes/plugins.js'
import { registerDeployRoutes } from './routes/deploy.js'
import { registerSchedulerRoutes } from './routes/scheduler.js'
import { registerGitRoutes } from './routes/git.js'
import { registerSearchRoutes } from './routes/search.js'
import { registerTaxonomyRoutes } from './routes/taxonomy.js'
import { registerBackupRoutes } from './routes/backup.js'
import { registerCacheRoutes } from './routes/cache.js'
import { registerFormRoutes } from './routes/forms.js'
import { registerFlexRoutes } from './routes/flex.js'
import { registerBlueprintRoutes } from './routes/blueprints.js'
import { BlueprintEngine, getCoreBlueprintsDir } from '../blueprint/BlueprintEngine.js'
import { FormLoader } from '../forms/FormLoader.js'
import { FlexLoader } from '../flex/FlexLoader.js'
import { FormSubmissionService } from '../forms/FormSubmissionService.js'
import { EmailService } from '../forms/EmailService.js'
import { TaxonomyIndex } from '../taxonomy/TaxonomyIndex.js'
import { Scheduler } from '../scheduler/Scheduler.js'
import { GitService } from '../git/GitService.js'
import { BackupService } from '../backup/BackupService.js'
import { S3Adapter } from '../backup/adapters/S3Adapter.js'
import { FtpAdapter } from '../backup/adapters/FtpAdapter.js'
import { ConfigLoader } from '../config/ConfigLoader.js'
import { BuildTrigger } from '../build/BuildTrigger.js'
import { BuildQueue } from '../build/BuildQueue.js'
import { HookSystem } from '../plugins/HookSystem.js'
import { PluginRegistry } from '../plugins/PluginRegistry.js'
import { PluginLoader } from '../plugins/PluginLoader.js'
import { PluginAPIImpl } from '../plugins/PluginAPI.js'
import { SearchIndex } from '../search/SearchIndex.js'
import { MemoryCache } from '../cache/MemoryCache.js'
import { NoopCache } from '../cache/NoopCache.js'
import { RedisCache } from '../cache/RedisCache.js'
import { CacheStats } from '../cache/CacheStats.js'
import type { CacheStore } from '../cache/CacheStore.js'
import type { BldmrkHooks } from '../plugins/types.js'
import type { AppConfig } from './types.js'
import { SiteRegistry } from '../multisite/SiteRegistry.js'
import { SiteServiceCache } from '../multisite/SiteServiceCache.js'
import { buildSiteContextMiddleware } from './middleware/siteContext.js'
import { registerHubRoutes } from './routes/hub.js'

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }

  const app = Fastify({
    logger: config.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: process.env.npm_package_version ?? 'unknown',
      uptime: process.uptime(),
    })
  })

  let siteServiceCache: SiteServiceCache | undefined

  // Multisite mode: register site context middleware and hub routes
  if (config.multisite?.enabled) {
    const registry = await SiteRegistry.load(
      config.multisite.configPath,
      config.projectDir ?? config.contentDir,
    )
    siteServiceCache = new SiteServiceCache()
    app.addHook('onRequest', buildSiteContextMiddleware(registry))
    await registerHubRoutes(app, {
      registry,
      siteServiceCache,
      buildTrigger: new BuildTrigger(),
      authPreHandler: async (_req, _reply) => {},
    })
  }

  await app.register(cors, {
    origin: config.corsOrigins?.length ? config.corsOrigins : [],
    credentials: true,
  })
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
  await app.register(multipart)
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute', global: true })

  // Load system config once; reuse for both cache setup and backup
  const configLoader = new ConfigLoader()
  const systemCfg = await configLoader.load(config.configDir).then(c => c.system).catch(() => null)
  const cacheCfg = systemCfg?.cache

  // Build cache store
  let cacheStore: CacheStore
  if (config.cacheStore) {
    cacheStore = config.cacheStore
  } else if (cacheCfg?.enabled === false) {
    cacheStore = new NoopCache()
  } else if (cacheCfg?.provider === 'redis' && cacheCfg.redis) {
    cacheStore = new RedisCache({
      host: cacheCfg.redis.host,
      port: cacheCfg.redis.port,
      password: cacheCfg.redis.password,
      db: cacheCfg.redis.db,
      keyPrefix: cacheCfg.redis.keyPrefix,
    })
  } else {
    cacheStore = new MemoryCache({
      ttl: cacheCfg?.ttl ?? 60,
      maxSize: cacheCfg?.maxSize ?? 500,
    })
  }

  const cacheStats = new CacheStats()
  await app.register(registerCachePlugin, { store: cacheStore, stats: cacheStats })
  registerCacheSendHook(app, cacheStore)

  const userStore = new UserStore(path.join(config.configDir, 'users.yaml'))
  const authService = new AuthService(userStore, config.jwtSecret)
  const permissionSystem = new PermissionSystem()
  const pagesDir = path.join(config.contentDir, 'pages')
  const pageLoader = new PageLoader(pagesDir)

  const buildTrigger = new BuildTrigger()
  const buildQueue = config.buildQueue ?? new BuildQueue(
    (dir) => buildTrigger.trigger(dir),
    config.projectDir ?? config.contentDir,
  )

  // Build initial search and taxonomy indexes
  const searchIndex = new SearchIndex()
  const taxonomyIndex = new TaxonomyIndex()
  try {
    const allPages = await pageLoader.loadAll()
    searchIndex.index(allPages)
    taxonomyIndex.rebuild(allPages)
  } catch {
    // Content dir may be empty on first run - indexes start empty
  }

  const authPreHandler = buildAuthMiddleware(authService)

  // Cache preHandlers for specific routes
  const pagesCache60 = makeCacheHandler(cacheStore, cacheStats, 60)
  const taxonomyCache300 = makeCacheHandler(cacheStore, cacheStats, 300)
  const searchCache30 = makeCacheHandler(cacheStore, cacheStats, 30)
  const siteConfigCache3600 = makeCacheHandler(cacheStore, cacheStats, 3600)

  await registerUserRoutes(app, { authService, userStore, permissionSystem, authPreHandler, siteServiceCache, jwtSecret: config.jwtSecret })

  const gitService = new GitService(config.projectDir ?? config.contentDir)
  await registerPageRoutes(app, {
    pageLoader,
    permissionSystem,
    authPreHandler,
    pagesDir,
    cachePreHandler: pagesCache60,
    cacheStore,
    siteServiceCache,
    gitService,
    autoCommit: systemCfg?.git?.autoCommit ?? false,
  })
  await registerMediaRoutes(app, { contentDir: config.contentDir, authPreHandler, siteServiceCache })
  await registerBuildRoutes(app, { buildQueue, authPreHandler })
  await registerConfigRoutes(app, {
    configDir: config.configDir,
    authPreHandler,
    siteConfigCachePreHandler: siteConfigCache3600,
    cacheStore,
    siteServiceCache,
  })
  await registerDeployRoutes(app, { configDir: config.configDir, buildQueue, authPreHandler })
  const hooks = new HookSystem<BldmrkHooks>()
  const pluginRegistry = new PluginRegistry()
  const pluginAPI = new PluginAPIImpl(hooks)
  const pluginLoader = new PluginLoader(config.configDir, pluginAPI, pluginRegistry)
  await pluginLoader.load()

  await registerPluginRoutes(app, { authPreHandler, registry: pluginRegistry, loader: pluginLoader })
  await registerSearchRoutes(app, { searchIndex, cachePreHandler: searchCache30, siteServiceCache })
  await registerTaxonomyRoutes(app, { taxonomyIndex, cachePreHandler: taxonomyCache300, siteServiceCache })

  const scheduler = new Scheduler()
  await registerSchedulerRoutes(app, { scheduler, authPreHandler })

  await registerGitRoutes(app, { gitService, authPreHandler })

  const projectDir = config.projectDir ?? config.contentDir

  let remoteAdapter
  let remoteProvider: string | undefined
  if (systemCfg?.backup?.remote) {
    const remote = systemCfg.backup.remote
    if (remote.provider === 's3' && remote.s3) {
      remoteAdapter = new S3Adapter(remote.s3)
      remoteProvider = 's3'
    } else if (remote.provider === 'ftp' && remote.ftp) {
      remoteAdapter = new FtpAdapter(remote.ftp)
      remoteProvider = 'ftp'
    }
  }

  const backupService = new BackupService({ projectDir, remoteAdapter, remoteProvider })

  if (systemCfg?.backup?.schedule) {
    const backupType = systemCfg.backup.type ?? 'content'
    const maxBackups = systemCfg.backup.maxBackups ?? 10
    scheduler.addJob({
      name: 'backup',
      schedule: systemCfg.backup.schedule,
      handler: async () => {
        await backupService.createBackup(backupType)
        await backupService.pruneOldBackups(maxBackups)
      },
    })
  }

  await registerBackupRoutes(app, { backupService, authPreHandler, siteServiceCache })
  await registerCacheRoutes(app, { cacheStore, cacheStats, authPreHandler })

  // Forms
  const formLoader = new FormLoader(config.contentDir)
  let emailService: EmailService | undefined
  if (systemCfg?.smtp) {
    emailService = new EmailService(systemCfg.smtp)
  }
  const formSubmissionService = new FormSubmissionService(formLoader, emailService, projectDir)
  await registerFormRoutes(app, { formLoader, formSubmissionService, authPreHandler, projectDir, siteServiceCache })

  // Flex Objects
  const flexLoader = new FlexLoader(config.contentDir)
  pluginAPI.setFlexLoader(flexLoader)
  await registerFlexRoutes(app, { flexLoader, authPreHandler, siteServiceCache })

  // Blueprints
  const userBlueprintsDir = path.join(config.contentDir, '..', 'blueprints')
  const blueprintEngine = new BlueprintEngine(getCoreBlueprintsDir(), userBlueprintsDir)
  await registerBlueprintRoutes(app, { blueprintEngine, authPreHandler })

  return app
}
