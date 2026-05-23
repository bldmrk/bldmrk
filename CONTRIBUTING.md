# Contributing to bldmrk

## Prerequisites

- Node.js 22+
- pnpm 9+: `corepack enable && corepack prepare pnpm@latest --activate`
- Git

## Development Setup

```bash
git clone https://github.com/bldmrk/bldmrk
cd bldmrk
pnpm install
bldmrk dev          # starts core API + admin Vite dev server
```

Admin: `http://localhost:3000/admin`

## Project Structure

```
packages/core/     CMS engine (Fastify, Zod, content pipeline)
packages/admin/    Admin SPA (Vue 3, TanStack Query, Tailwind)
packages/cli/      CLI (citty, inquirer)
themes/default/    Astro SSG theme
plugins/           Bundled plugins (sitemap, rss, seo)
docs/              Architecture specs and implementation plans
```

## Commands

```bash
pnpm test:unit          # Vitest unit tests (co-located *.test.ts)
pnpm test:unit --watch  # Watch mode for TDD
pnpm test:integration   # Real Fastify server tests (*.integration.test.ts)
pnpm test:e2e           # Playwright E2E (requires built admin)
pnpm typecheck          # tsc --noEmit across all packages
pnpm lint               # ESLint
```

## Conventions

**Commits:** `type(scope): message`
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `security`, `chore`
Examples: `feat(admin): add tag field component`, `fix(api): handle empty slug in page routes`

**Tests:** Always TDD — write the failing test first, then implement.
- Unit tests: co-located `*.test.ts`, use `memfs` for file system mocking
- Integration tests: `*.integration.test.ts`, spin up real Fastify on a `mkdtemp` dir
- Coverage targets: `@bldmrk/core` ≥ 90%, `@bldmrk/admin` composables ≥ 80%

**TypeScript:** Strict mode. No `any`. Use Zod for all runtime validation.

**Vue components:** `<script setup lang="ts">`, composition API only, Tailwind for styling.

## Adding a Blueprint Field Type

1. Add the type string to the enum in `packages/core/src/flex/FlexSchema.ts`
2. Create `packages/admin/src/components/blueprint/fields/YourField.vue`
3. Add a `v-else-if` branch in `BlueprintField.vue`
4. Add a test case to `packages/core/src/flex/FlexSchema.test.ts`

## Pull Requests

- Branch from `main`, name it `feat/your-feature` or `fix/bug-description`
- All tests must pass: `pnpm test:unit && pnpm test:integration && pnpm typecheck`
- One logical change per PR — keep diffs reviewable
- Update relevant docs in the same PR as the code change

## Questions?

Open a [GitHub Discussion](https://github.com/bldmrk/bldmrk/discussions) or file an issue.
