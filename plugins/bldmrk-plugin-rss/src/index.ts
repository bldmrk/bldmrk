import { writeFile } from 'fs/promises'
import path from 'path'
import type { BldmrkPlugin, BldmrkAPI, PageObject } from '@bldmrk/core'

export interface RssConfig {
  siteUrl: string
  title: string
  description?: string
  distDir?: string
  maxItems?: number
}

export function generateRssXml(config: RssConfig, pages: PageObject[]): string {
  const base = config.siteUrl.replace(/\/$/, '')
  const sorted = [...pages]
    .filter(p => p.meta.published && p.meta.date)
    .sort((a, b) => (b.meta.date?.toISOString() ?? '').localeCompare(a.meta.date?.toISOString() ?? ''))
    .slice(0, config.maxItems ?? 20)

  const items = sorted.map(p => `  <item>
    <title>${p.meta.title}</title>
    <link>${base}/${p.slug}</link>
    <pubDate>${new Date(p.meta.date!).toUTCString()}</pubDate>
    <description>${p.meta.description ?? ''}</description>
  </item>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${config.title}</title>
    <link>${base}</link>
    <description>${config.description ?? ''}</description>
${items}
  </channel>
</rss>`
}

export function createRssPlugin(config: RssConfig): BldmrkPlugin {
  const recentPages: PageObject[] = []

  return {
    name: 'bldmrk-plugin-rss',
    version: '1.0.0',
    setup(api: BldmrkAPI) {
      api.hooks.on('search:index', async ({ pages }) => {
        recentPages.length = 0
        recentPages.push(...pages)
      })

      api.hooks.on('build:complete', async () => {
        const distDir = config.distDir ?? 'dist'
        try {
          const xml = generateRssXml(config, recentPages)
          await writeFile(path.join(distDir, 'feed.xml'), xml, 'utf-8')
        } catch (err) {
          console.error('[bldmrk-plugin-rss] Failed to write feed.xml:', err)
        }
      })
    },
  }
}

export default createRssPlugin({ siteUrl: 'http://localhost', title: 'bldmrk RSS' })
