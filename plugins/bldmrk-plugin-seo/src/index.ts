import type { BldmrkPlugin, BldmrkAPI } from '@bldmrk/core'

export interface SeoConfig {
  siteName?: string
  defaultDescription?: string
}

function buildMetaTags(html: string, config: SeoConfig, title?: string, description?: string): string {
  const effectiveTitle = title ? `${title} — ${config.siteName ?? 'bldmrk'}` : (config.siteName ?? 'bldmrk')
  const effectiveDesc = description ?? config.defaultDescription ?? ''

  const metas = [
    `<title>${effectiveTitle}</title>`,
    `<meta name="description" content="${effectiveDesc}">`,
    `<meta property="og:title" content="${effectiveTitle}">`,
    `<meta property="og:description" content="${effectiveDesc}">`,
    `<meta property="og:type" content="website">`,
  ].join('\n    ')

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n    ${metas}`)
  }
  return `${metas}\n${html}`
}

export function createSeoPlugin(config: SeoConfig = {}): BldmrkPlugin {
  return {
    name: 'bldmrk-plugin-seo',
    version: '1.0.0',
    setup(api: BldmrkAPI) {
      api.hooks.on('page:after-render', async (ctx) => {
        ctx.html = buildMetaTags(
          ctx.html,
          config,
          ctx.page.meta.title,
          ctx.page.meta.description,
        )
      })
    },
  }
}

export default createSeoPlugin()
