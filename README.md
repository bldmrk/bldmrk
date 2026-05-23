# bldmrk

**The flat-file CMS for developers.** MDX content, Vue 3 admin dashboard, Astro static site generation — TypeScript-first, no database required.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## What is bldmrk?

bldmrk is a self-hosted, flat-file content management system built for developers who want full control over their content without the complexity of a database. Inspired by [Grav CMS](https://getgrav.org/), rebuilt from the ground up in TypeScript.

Your content lives as plain MDX files in a `content/` folder — git-friendly, portable, and never locked into a proprietary format.

---

## Features

| | |
|---|---|
| **Flat-file content** | Pages as MDX files with YAML metadata — no database, no migrations |
| **Vue 3 admin** | Full-featured SPA with split-view MDX editor, page tree, media browser |
| **Astro SSG** | Generates a static site from your content with Vue islands |
| **Blueprint forms** | Define admin forms in YAML, rendered automatically — Grav-style |
| **Git revision history** | Every save is a commit; restore any version from the admin |
| **Plugin system** | Extend via npm packages with the `bldmrk-plugin` keyword |
| **REST API** | Full JSON API for headless and decoupled use cases |
| **Flex Objects** | Custom content types defined with YAML schemas |
| **TypeScript-first** | Strict mode, Zod validation throughout, 400+ tests |
| **Self-hosted** | Docker-ready, runs anywhere Node.js runs |

---

## Quickstart

**Requirements:** Node.js 22+, pnpm

```bash
npx @bldmrk/create my-site
cd my-site
pnpm install
bldmrk dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin) and log in with the credentials shown during setup.

### Docker

```bash
cp .env.example .env
# Set JWT_SECRET in .env
docker compose up
```

---

## Content Format

Content lives in plain files — no proprietary format, no lock-in:

```
content/
├── pages/
│   ├── 001--home/
│   │   ├── index.mdx        # MDX content (Markdown + Vue components)
│   │   ├── page.yaml        # title, template, published, tags, routes
│   │   └── media/           # page-specific uploads
│   └── 002--blog/
│       └── 001--first-post/
│           └── index.mdx
├── config/
│   ├── site.yaml            # site name, description, base URL
│   └── system.yaml          # port, CORS, cache, git settings
├── media/                   # global media library
└── data/                    # arbitrary YAML data files
```

Folder names use a `NNN--slug` convention: the number controls ordering, the slug becomes the URL.

---

## Architecture

bldmrk is a pnpm monorepo with three packages and a theme:

```
packages/
  core/          Node.js + Fastify 5    CMS engine, REST API, file watcher, plugin system
  admin/         Vue 3 + Vite           Admin SPA — served by core at /admin
  cli/           Node.js                bldmrk init / dev / build / start
  create/        Node.js                npx @bldmrk/create scaffolder

themes/
  default/       Astro + Vue            Public static site (output to dist/)

plugins/
  bldmrk-plugin-rss/        Built-in RSS feed plugin
  bldmrk-plugin-seo/        Built-in SEO meta plugin
  bldmrk-plugin-sitemap/    Built-in sitemap plugin
```

Communication between packages is exclusively via the REST API and SSE — the admin never touches the filesystem directly.

---

## Plugin Development

Plugins are npm packages. Add `"bldmrk-plugin"` to your `keywords` and bldmrk auto-discovers them:

```typescript
// my-bldmrk-plugin/index.ts
import type { BldmrkPlugin, BldmrkAPI } from '@bldmrk/core'

export default {
  name: 'my-plugin',
  version: '1.0.0',
  setup(bldmrk: BldmrkAPI) {
    bldmrk.hooks.on('page:saved', async ({ page }) => {
      console.log(`Saved: ${page.slug}`)
    })

    bldmrk.addRoute('GET', '/api/my-plugin/hello', async () => ({
      hello: 'world',
    }))
  },
} satisfies BldmrkPlugin
```

```json
{
  "name": "my-bldmrk-plugin",
  "keywords": ["bldmrk-plugin"]
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ |
| API server | Fastify 5 |
| Schema validation | Zod 3 |
| Auth | JWT via `jose` (Web Crypto API) |
| Passwords | argon2 |
| Admin UI | Vue 3 + Pinia + TanStack Query |
| Editor | CodeMirror 6 with MDX highlighting |
| Static site | Astro 5 + Vue islands |
| Images | Sharp (WebP/AVIF, resize, thumbnails) |
| Search | flexsearch |
| Monorepo | pnpm workspaces |

---

## CLI Reference

```bash
bldmrk init          # scaffold a new project
bldmrk dev           # start API + admin in development mode
bldmrk build         # generate static site to dist/
bldmrk start         # start in production mode
bldmrk user create   # create or manage users
bldmrk plugin list   # list installed plugins
```

---

## Development

```bash
pnpm install
pnpm test:unit          # Vitest unit tests
pnpm test:integration   # integration tests (real Fastify server)
pnpm test:e2e           # Playwright E2E tests
pnpm typecheck          # TypeScript strict check across all packages
pnpm lint               # ESLint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## License

[MIT](LICENSE)
