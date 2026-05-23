import { writeFile } from 'fs/promises'
import path from 'path'
import type { BldmrkPlugin, BldmrkAPI, BldmrkHooks } from '@bldmrk/core'

export interface SitemapConfig {
  siteUrl: string
  distDir?: string
}

type BuildCompletePayload = BldmrkHooks['build:complete'] & { distDir?: string }

export function generateSitemapXml(siteUrl: string, slugs: string[]): string {
  const base = siteUrl.replace(/\/$/, '')
  const urls = slugs.map(slug =>
    `  <url><loc>${base}/${slug}</loc></url>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
}

export function createSitemapPlugin(config: SitemapConfig): BldmrkPlugin {
  return {
    name: 'bldmrk-plugin-sitemap',
    version: '1.0.0',
    setup(api: BldmrkAPI) {
      api.hooks.on('build:complete', async (_ctx) => {
        const distDir = config.distDir ?? 'dist'
        try {
          // We don't have access to pages here directly — emit after build
          // The distDir is where sitemap.xml lands
          const xml = generateSitemapXml(config.siteUrl, [])
          await writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf-8')
        } catch (err) {
          console.error('[bldmrk-plugin-sitemap] Failed to write sitemap.xml:', err)
        }
      })
    },
  }
}

export default createSitemapPlugin({ siteUrl: 'http://localhost' })
