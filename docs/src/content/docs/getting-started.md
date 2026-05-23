---
title: Getting Started
description: Install and run bldmrk in minutes.
---

## Installation

The fastest way to start a new bldmrk project is with the interactive wizard:

```bash
npx @bldmrk/create my-site
```

The wizard will ask for:
- **Project name** — used as the folder name and package name
- **Description** — shown in metadata and the README
- **Theme** — choose from available themes (default: Astro-based starter)
- **Plugins** — optional SEO, Sitemap, and RSS plugins

Once finished the wizard runs `pnpm install` and your site is ready.

## Starting the development server

```bash
cd my-site
bldmrk dev
```

This starts:
- Core API on **http://localhost:3000**
- Admin UI on **http://localhost:3000/admin**
- Public preview on **http://localhost:4322** (Astro dev server)

## Your first build

```bash
bldmrk build
```

The static site is output to `dist/`. Deploy the contents of `dist/` to any static host.

## Project structure

```
my-site/
├── content/
│   ├── pages/          # Your page content (MDX + YAML)
│   │   ├── 001--home/
│   │   └── 002--blog/
│   ├── media/          # Global media files
│   ├── data/           # Reusable YAML data files
│   └── config/
│       ├── site.yaml   # Site-wide settings
│       └── system.yaml # Server settings
├── themes/
│   └── default/        # Astro theme
├── plugins/            # Local plugins
└── package.json
```

## Next steps

- [Content Format](/content-format) — learn how pages and metadata work
- [Themes](/themes) — customise or build your own theme
- [Plugins](/plugins) — extend bldmrk with plugins
- [CLI Reference](/cli-reference) — all available commands
