import { watch, type FSWatcher } from 'chokidar'
import type { PageLoader } from '../content/PageLoader.js'
import type { BuildQueue } from '../build/BuildQueue.js'
import type { SearchIndex } from '../search/SearchIndex.js'
import type { TaxonomyIndex } from '../taxonomy/TaxonomyIndex.js'
import type { CacheStore } from '../cache/CacheStore.js'
import type { SiteContext } from '../multisite/SiteContext.js'

const FOLDER_SLUG_RE = /\d+--([^/\\]+)[/\\]/

export class ContentWatcher {
  private watcher: FSWatcher | null = null

  constructor(
    private pageLoader: PageLoader,
    private buildQueue: BuildQueue,
    private searchIndex?: SearchIndex,
    private taxonomyIndex?: TaxonomyIndex,
    private cacheStore?: CacheStore,
  ) {}

  start(contentDir: string): void {
    if (this.watcher) return
    this.watcher = watch(contentDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    this.watcher.on('change', (filePath: string) => this.handleChange(filePath))
    this.watcher.on('add', (filePath: string) => this.handleChange(filePath))
    this.watcher.on('unlink', (filePath: string) => this.handleUnlink(filePath))
  }

  async stop(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
  }

  private handleChange(filePath: string): void {
    this.pageLoader.invalidateAll()
    this.buildQueue.enqueue()

    if (this.cacheStore) {
      void Promise.all([
        this.cacheStore.deleteByPrefix('GET:/api/pages'),
        this.cacheStore.deleteByPrefix('GET:/api/taxonomy'),
      ]).catch(() => {
        // Cache invalidation errors must not crash the watcher
      })
    }

    if (this.searchIndex || this.taxonomyIndex) {
      const slug = this.extractSlug(filePath)
      if (slug) {
        void this.pageLoader.load(slug).then(page => {
          this.searchIndex?.add(page)
        }).catch(() => {
          // Page not found or load error - skip search index update
        })
      }
    }

    if (this.taxonomyIndex) {
      void this.pageLoader.loadAll().then(pages => {
        this.taxonomyIndex!.rebuild(pages)
      }).catch(() => {
        // loadAll error - skip taxonomy rebuild
      })
    }
  }

  private handleUnlink(filePath: string): void {
    this.pageLoader.invalidateAll()
    this.buildQueue.enqueue()

    if (this.cacheStore) {
      void Promise.all([
        this.cacheStore.deleteByPrefix('GET:/api/pages'),
        this.cacheStore.deleteByPrefix('GET:/api/taxonomy'),
      ]).catch(() => {
        // Cache invalidation errors must not crash the watcher
      })
    }

    if (this.searchIndex) {
      const slug = this.extractSlug(filePath)
      if (slug) {
        this.searchIndex.remove(slug)
      }
    }

    if (this.taxonomyIndex) {
      void this.pageLoader.loadAll().then(pages => {
        this.taxonomyIndex!.rebuild(pages)
      }).catch(() => {
        // loadAll error - skip taxonomy rebuild
      })
    }
  }

  private extractSlug(filePath: string): string | null {
    const match = FOLDER_SLUG_RE.exec(filePath)
    return match?.[1] ?? null
  }

  /**
   * Creates one ContentWatcher per site for multi-site setups.
   * Each watcher monitors its own site's contentDir independently.
   */
  static forMultiSite(
    sites: SiteContext[],
    getServices: (siteId: string) => {
      pageLoader: PageLoader
      buildQueue: BuildQueue
      searchIndex?: SearchIndex
      taxonomyIndex?: TaxonomyIndex
      cacheStore?: CacheStore
    },
  ): ContentWatcher[] {
    return sites.map(site => {
      const services = getServices(site.id)
      const watcher = new ContentWatcher(
        services.pageLoader,
        services.buildQueue,
        services.searchIndex,
        services.taxonomyIndex,
        services.cacheStore,
      )
      watcher.start(site.contentDir)
      return watcher
    })
  }
}
