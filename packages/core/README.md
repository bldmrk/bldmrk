# @bldmrk/core

The core engine of [bldmrk](https://github.com/bldmrk/bldmrk) — a flat-file CMS built on Node.js and Fastify.

## What's included

- **Content API** — REST endpoints for pages, media, users, search, and build status (SSE)
- **PageLoader** — reads MDX/Markdown pages from the filesystem with caching
- **MediaProcessor** — image resizing and WebP/AVIF conversion via Sharp
- **Plugin system** — typed async hook system for extending CMS behavior
- **Auth** — JWT-based authentication with role-based permissions (admin / editor / viewer)
- **ContentWatcher** — file watcher that triggers incremental builds on content changes
- **Multi-site support** — run multiple sites from a single instance

## Usage

```ts
import { createApp } from '@bldmrk/core'

const app = await createApp({
  port: 3000,
  contentDir: './content',
  // ...
})

await app.listen({ port: 3000 })
```

## Part of bldmrk

| Package | Role |
|---------|------|
| `@bldmrk/core` | CMS engine (this package) |
| `@bldmrk/cli` | `bldmrk` CLI |
| `@bldmrk/create` | Project scaffolding |

## Requirements

- Node.js 20+
- pnpm (recommended)
