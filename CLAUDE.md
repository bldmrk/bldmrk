# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bldmrk is a Node.js/TypeScript flat-file CMS inspired by Grav CMS (PHP). It is a **monorepo** managed with pnpm workspaces, not yet implemented — `FOLIO_PLAN.md` is the authoritative architecture document.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Development (Core API + Admin dev server)
bldmrk dev
# or directly:
pnpm dev

# Build static site (Astro SSG)
bldmrk build
pnpm build:admin    # Build Admin SPA only
pnpm build:theme    # Build default theme only

# Tests
pnpm test:unit          # Vitest unit tests (co-located *.test.ts files)
pnpm test:unit --watch  # Watch mode for TDD
pnpm test:integration   # Vitest integration tests (real Fastify server)
pnpm test:e2e           # Playwright E2E (requires built admin + theme)
pnpm test:unit --coverage  # With coverage report

# Linting / formatting
pnpm lint
pnpm typecheck
```

## Architecture

Three packages serve distinct roles and communicate exclusively via the REST API and SSE:

| Package | Tech | Role |
|---------|------|------|
| `packages/core` (`@bldmrk/core`) | Node.js + Fastify 5 | CMS engine: content API, file watcher, build trigger, plugin system, auth |
| `packages/admin` (`@bldmrk/admin`) | Vue 3 SPA + Vite 5 | Admin dashboard, served by core under `/admin` |
| `themes/default` (`@bldmrk/theme-default`) | Astro + Vue islands | Public static site, output to `dist/` |
| `packages/cli` (`@bldmrk/cli`) | Node.js CLI | `bldmrk` command — init, dev, build, user/plugin management |

## Content Format

Pages live in `content/pages/` using folder-as-document convention:
- Folders: `NNN--slug/` (3-digit prefix for ordering, slug is the URL path)
- `index.mdx` — page content (Markdown + Vue components via MDX)
- `page.yaml` — metadata (title, template, published, tags, routes, i18n)
- `media/` subfolder — page-specific media

Global content: `content/media/`, `content/data/*.yaml`, `content/config/site.yaml`, `content/config/system.yaml`.

`page.yaml` frontmatter in `index.mdx` overrides `page.yaml` values when both exist.

## Core Module Map (`packages/core/src/`)

- `content/PageLoader.ts` — filesystem → PageObject with caching (critical path)
- `content/PageTree.ts` — hierarchy, routing, prev/next/children
- `content/ContentParser.ts` — MDX/Markdown → HTML via unified pipeline
- `content/FrontmatterSchema.ts` — Zod schemas for page.yaml validation
- `content/MediaProcessor.ts` — Sharp: resize, WebP/AVIF, thumbnails
- `api/server.ts` — Fastify app setup
- `api/routes/` — REST endpoints: pages, media, build (SSE), plugins, search, users
- `plugins/HookSystem.ts` — typed async event system; hook names defined in `BldmrkHooks` type
- `config/ConfigLoader.ts` — loads site.yaml + system.yaml, validates with Zod, returns typed config
- `config/ConfigSchema.ts` — Zod schemas for SiteConfig / SystemConfig with defaults
- `users/UserStore.ts` — YAML-backed user persistence with argon2 password hashing
- `users/AuthService.ts` — JWT via `jose` (Web Crypto API); login, verifyToken, refreshToken
- `users/PermissionSystem.ts` — role-based access control (admin / editor / viewer)
- `watcher/ContentWatcher.ts` — chokidar → BuildQueue + SearchIndex rebuild
- `build/BuildQueue.ts` — debounced queue to prevent build spam

## Admin Module Map (`packages/admin/src/`)

- `composables/useApi.ts` — typed wrapper for all Core REST calls
- `composables/useBuildStatus.ts` — SSE connection for real-time build logs
- `stores/pages.ts` / `media.ts` / `auth.ts` — Pinia stores
- `components/MdxEditor.vue` — CodeMirror 6 with MDX syntax highlighting
- `components/PageTree.vue` — recursive tree with vue-draggable-plus
- `router/index.ts` — Vue Router with auth guards

## Plugin System

Plugins are npm packages with `"bldmrk-plugin"` keyword. They receive a `BldmrkAPI` instance in `setup(bldmrk)` and can register hooks, add API routes, and extend the admin UI. Hook types are defined centrally in `BldmrkHooks` in `packages/core/src/plugins/HookSystem.ts`.

## Testing Conventions

- **Unit tests**: co-located `*.test.ts` files; use `memfs` to mock `fs/promises` — never touch real disk
- **Integration tests**: `*.integration.test.ts`; spin up real Fastify on a `mkdtemp` directory, tear down in `afterAll`
- **E2E tests**: in `packages/admin/tests/e2e/` and `themes/default/tests/e2e/`; require a built admin + running core server
- TDD workflow: write failing test → minimal implementation → refactor → integration test → E2E test
- Coverage targets: `@bldmrk/core` ≥ 90%, `@bldmrk/admin` composables/stores ≥ 80%
- **ALWAYS** use TDD

## Key Technology Choices

- **Fastify 5** over Express (TypeScript-first, faster)
- **Zod 3** for all schema validation (TypeScript inference + runtime)
- **jose** for JWT (ESM-native, Web Crypto API, no native deps)
- **Sharp** for images (libvips, WebP/AVIF native)
- **flexsearch** for full-text search (< 6kb bundle)
- **pnpm workspaces** for monorepo (no Nx/Lerna overhead)
- **CodeMirror 6** over Monaco (smaller bundle, mobile-friendly)
- **TanStack Query** for admin API state (caching + auto-refetch)
- TypeScript strict mode throughout — no `any`

## Documentation

Always keep documentation up to date with every code change.
Never change code without updating the relevant docs in the same step.

**README.md** — Project overview, quickstart, links to `docs/`.

Rules: split files when they grow unwieldy, use subfolders when the domain warrants it, prefer many focused files over few large ones.