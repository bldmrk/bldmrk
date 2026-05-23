import path from 'path'
import { PageLoader } from '../content/PageLoader.js'
import { UserStore } from '../users/UserStore.js'
import { SearchIndex } from '../search/SearchIndex.js'
import { TaxonomyIndex } from '../taxonomy/TaxonomyIndex.js'
import { FlexLoader } from '../flex/FlexLoader.js'
import { FormLoader } from '../forms/FormLoader.js'
import { FormSubmissionService } from '../forms/FormSubmissionService.js'
import { BackupService } from '../backup/BackupService.js'
import { BuildQueue } from '../build/BuildQueue.js'
import type { BuildTrigger } from '../build/BuildTrigger.js'
import type { SiteContext } from './SiteContext.js'

const MAX_SITES = 20

interface SiteServices {
  pageLoader: PageLoader
  userStore: UserStore
  searchIndex: SearchIndex
  searchIndexReady: Promise<void>
  taxonomyIndex: TaxonomyIndex
  taxonomyIndexReady: Promise<void>
  flexLoader: FlexLoader
  formLoader: FormLoader
  formSubmissionService: FormSubmissionService
  backupService: BackupService
  buildQueues: Map<string, BuildQueue>
  lastAccessed: number
}

export class SiteServiceCache {
  private cache = new Map<string, SiteServices>()

  private getOrCreate(ctx: SiteContext): SiteServices {
    const existing = this.cache.get(ctx.id)
    if (existing) {
      existing.lastAccessed = Date.now()
      return existing
    }

    if (this.cache.size >= MAX_SITES) {
      let oldestKey: string | null = null
      let oldestTime = Infinity
      for (const [key, services] of this.cache) {
        if (services.lastAccessed < oldestTime) {
          oldestTime = services.lastAccessed
          oldestKey = key
        }
      }
      if (oldestKey !== null) {
        this.cache.delete(oldestKey)
      }
    }

    const pagesDir = path.join(ctx.contentDir, 'pages')
    const pageLoader = new PageLoader(pagesDir)
    const userStore = new UserStore(path.join(ctx.configDir, 'users.yaml'))
    const searchIndex = new SearchIndex()
    const taxonomyIndex = new TaxonomyIndex()
    const flexLoader = new FlexLoader(ctx.contentDir)
    const formLoader = new FormLoader(ctx.contentDir)
    const formSubmissionService = new FormSubmissionService(formLoader, undefined, ctx.contentDir)
    const backupService = new BackupService({ projectDir: ctx.contentDir })

    const searchIndexReady = pageLoader.loadAll()
      .then(pages => { searchIndex.index(pages) })
      .catch(() => {})

    const taxonomyIndexReady = pageLoader.loadAll()
      .then(pages => { taxonomyIndex.rebuild(pages) })
      .catch(() => {})

    const services: SiteServices = {
      pageLoader,
      userStore,
      searchIndex,
      searchIndexReady,
      taxonomyIndex,
      taxonomyIndexReady,
      flexLoader,
      formLoader,
      formSubmissionService,
      backupService,
      buildQueues: new Map(),
      lastAccessed: Date.now(),
    }

    this.cache.set(ctx.id, services)
    return services
  }

  getPageLoader(ctx: SiteContext): PageLoader {
    return this.getOrCreate(ctx).pageLoader
  }

  getUserStore(ctx: SiteContext): UserStore {
    return this.getOrCreate(ctx).userStore
  }

  async getSearchIndex(ctx: SiteContext): Promise<SearchIndex> {
    const services = this.getOrCreate(ctx)
    await services.searchIndexReady
    return services.searchIndex
  }

  async getTaxonomyIndex(ctx: SiteContext): Promise<TaxonomyIndex> {
    const services = this.getOrCreate(ctx)
    await services.taxonomyIndexReady
    return services.taxonomyIndex
  }

  getBackupService(ctx: SiteContext): BackupService {
    return this.getOrCreate(ctx).backupService
  }

  getFlexLoader(ctx: SiteContext): FlexLoader {
    return this.getOrCreate(ctx).flexLoader
  }

  getFormLoader(ctx: SiteContext): FormLoader {
    return this.getOrCreate(ctx).formLoader
  }

  getFormSubmissionService(ctx: SiteContext): FormSubmissionService {
    return this.getOrCreate(ctx).formSubmissionService
  }

  getBuildQueue(ctx: SiteContext, buildTrigger: BuildTrigger): BuildQueue {
    const services = this.getOrCreate(ctx)
    let queue = services.buildQueues.get(ctx.id)
    if (!queue) {
      queue = new BuildQueue(
        (dir) => buildTrigger.trigger(dir),
        ctx.contentDir,
      )
      services.buildQueues.set(ctx.id, queue)
    }
    return queue
  }

  getCachedPageLoader(ctx: SiteContext): PageLoader | null {
    return this.cache.get(ctx.id)?.pageLoader ?? null
  }

  getCachedBackupService(ctx: SiteContext): BackupService | null {
    return this.cache.get(ctx.id)?.backupService ?? null
  }
}
