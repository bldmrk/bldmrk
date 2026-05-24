# @bldmrk/create

Scaffolding tool for [bldmrk](https://github.com/bldmrk/bldmrk) — a flat-file CMS built on Node.js.

## Usage

```bash
npm create bldmrk@latest
# or
npx create-bldmrk
```

The interactive wizard will ask for a project name and description, then generate a ready-to-use project directory.

## What gets generated

```
my-site/
├── content/
│   ├── config/
│   │   ├── site.yaml       # Site settings
│   │   └── system.yaml     # CMS configuration
│   └── pages/
│       ├── 001--home/
│       │   ├── index.mdx
│       │   └── page.yaml
│       └── 002--blog/
├── package.json
└── pnpm-workspace.yaml
```

## After scaffolding

```bash
cd my-site
npm install
npm run dev     # Start dev server at http://localhost:3000
npm run build   # Build static site
```

## Requirements

- Node.js 20+
- npm 7+ (for `npm create`)
