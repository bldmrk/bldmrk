# @bldmrk/cli

The CLI for [bldmrk](https://github.com/bldmrk/bldmrk) — a flat-file CMS built on Node.js.

## Installation

```bash
npm install @bldmrk/cli
```

Or install globally:

```bash
npm install -g @bldmrk/cli
```

## Commands

### Development

```bash
bldmrk dev          # Start API server + admin dev server
bldmrk build        # Build static site (Astro SSG)
```

### Project

```bash
bldmrk init [name]  # Scaffold a new bldmrk project
```

### Pages

```bash
bldmrk pages list           # List all pages
bldmrk pages create         # Create a new page interactively
bldmrk pages validate       # Validate all page.yaml files
```

### Users

```bash
bldmrk user create   # Create a new user interactively
bldmrk user list     # List all users
```

### Multi-site

```bash
bldmrk site create   # Add a site to a multi-site setup
bldmrk site list     # List all configured sites
bldmrk site build    # Build one or all sites
bldmrk site backup   # Backup one or all sites
bldmrk site migrate  # Migrate single-site content to multi-site layout
```

## Requirements

- Node.js 20+
