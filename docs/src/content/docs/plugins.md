---
title: Plugins
description: Extend bldmrk with the plugin API.
---

## Overview

Plugins are npm packages that hook into the bldmrk lifecycle. They can:

- React to build and content events via **hooks**
- Add custom **REST API routes** to the core server
- Extend the **admin UI** with custom panels

## Plugin entry point

Every plugin must export a `setup` function as its default export:

```typescript
import type { BldmrkAPI } from '@bldmrk/core'

export default function setup(bldmrk: BldmrkAPI): void {
  // register hooks, routes, etc.
}
```

## BldmrkHooks overview

Hooks let your plugin react to lifecycle events. Register with `bldmrk.hooks.on(hookName, handler)`:

| Hook | When it fires | Payload |
|------|--------------|---------|
| `beforeBuild` | Before the static site build starts | `{ pages: PageObject[] }` |
| `afterBuild` | After a successful build | `{ pages: PageObject[], outputDir: string }` |
| `beforePageRender` | Before each page is rendered | `{ page: PageObject }` |
| `afterPageRender` | After each page is rendered | `{ page: PageObject, html: string }` |
| `onContentChange` | When a content file changes (watch mode) | `{ path: string, event: 'add' \| 'change' \| 'unlink' }` |
| `onServerStart` | After the Fastify server starts | `{ port: number }` |

## Example: SEO plugin

```typescript
import type { BldmrkAPI, PageObject } from '@bldmrk/core'

export default function setup(bldmrk: BldmrkAPI): void {
  bldmrk.hooks.on('beforePageRender', async ({ page }) => {
    // Inject canonical URL into page metadata
    page.meta ??= {}
    page.meta.canonical = `${bldmrk.config.site.url}${page.route}`
  })

  bldmrk.hooks.on('afterBuild', async ({ outputDir }) => {
    // Generate sitemap.xml
    await generateSitemap(outputDir, bldmrk.config)
  })
}

async function generateSitemap(outputDir: string, config: unknown): Promise<void> {
  // ... implementation
}
```

## Adding API routes

Use `bldmrk.server` (the Fastify instance) to register additional endpoints:

```typescript
export default function setup(bldmrk: BldmrkAPI): void {
  bldmrk.server.get('/api/my-plugin/status', async (_req, reply) => {
    return reply.send({ ok: true })
  })
}
```

## Publishing a plugin

1. Add the keyword `bldmrk-plugin` to your `package.json`
2. Export a `setup(bldmrk: BldmrkAPI): void` default function
3. Publish to npm: `npm publish`

```json
{
  "name": "bldmrk-plugin-my-plugin",
  "version": "1.0.0",
  "keywords": ["bldmrk-plugin"],
  "exports": {
    ".": "./dist/index.js"
  }
}
```

Users install your plugin and add it to `content/config/system.yaml`:

```yaml
plugins:
  - bldmrk-plugin-my-plugin
```

## Installing plugins via CLI

```bash
bldmrk plugin add bldmrk-plugin-seo
bldmrk plugin remove bldmrk-plugin-seo
bldmrk plugin list
```
