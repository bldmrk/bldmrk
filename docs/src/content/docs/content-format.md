---
title: Content Format
description: How bldmrk organises pages, media, and configuration.
---

## Folder-as-document convention

Every page is a folder inside `content/pages/`. The folder name encodes both the **order** and the **URL slug**:

```
NNN--slug/
```

- `NNN` — a 3-digit integer that controls sort order (e.g. `001`, `042`)
- `slug` — becomes the URL path segment

### Example structure

```
content/pages/
├── 001--home/
│   ├── index.mdx
│   ├── page.yaml
│   └── media/
├── 002--about/
│   ├── index.mdx
│   └── page.yaml
└── 003--blog/
    ├── index.mdx
    ├── page.yaml
    └── 001--first-post/
        ├── index.mdx
        └── page.yaml
```

Nested folders create **child pages**. The URL for the blog post above would be `/blog/first-post`.

## page.yaml

Every page folder should contain a `page.yaml` with metadata:

```yaml
title: "My Page Title"
template: default          # Theme template to use
published: true            # false = draft (hidden from public)
tags:
  - news
  - tutorial
routes:                    # Optional URL aliases
  - /old-url
i18n:
  de:
    title: "Mein Seitentitel"
```

### Available fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title (required) |
| `template` | string | Theme template name (default: `default`) |
| `published` | boolean | Whether the page is public (default: `true`) |
| `tags` | string[] | Taxonomy tags |
| `routes` | string[] | Additional URL aliases |
| `i18n` | object | Per-locale overrides for any field |

## index.mdx

Page content is written in **MDX** — Markdown with optional Vue component imports:

```mdx
---
title: My Page
published: true
---

# Hello World

This is **Markdown** with support for Vue components.

import MyComponent from '../../components/MyComponent.vue'

<MyComponent greeting="Hello" />
```

Frontmatter in `index.mdx` overrides the corresponding fields in `page.yaml`.

## Global content

| Path | Purpose |
|------|---------|
| `content/config/site.yaml` | Site-wide settings (name, description, URL) |
| `content/config/system.yaml` | Server settings (port, log level) |
| `content/media/` | Global media library |
| `content/data/*.yaml` | Arbitrary reusable data files |

## site.yaml reference

```yaml
name: "My Site"
description: "A bldmrk site"
url: "https://example.com"
locale: en
```

## system.yaml reference

```yaml
port: 3000
adminPath: /admin
logLevel: info   # debug | info | warn | error
```
