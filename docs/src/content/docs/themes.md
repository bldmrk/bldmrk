---
title: Themes
description: Customise the public-facing site with Astro-based themes.
---

## How themes work

Themes live in the `themes/` directory of your project and are standard **Astro** packages. bldmrk passes a fully-resolved page tree to your theme at build time; your theme decides how to render it.

The default theme is installed at `themes/default/` and uses Astro with optional Vue islands.

## theme.yaml options

Each theme can expose configuration via `theme.yaml` at the theme root:

```yaml
name: My Theme
version: 1.0.0
options:
  primaryColor: "#3b82f6"
  fontFamily: "Inter, sans-serif"
  showSidebar: true
  postsPerPage: 10
```

Access these options inside your Astro components via the `Astro.locals.theme` object (injected by bldmrk at build time).

## Template resolution

When a page sets `template: blog-post` in `page.yaml`, bldmrk looks for:

1. `themes/<active-theme>/src/templates/blog-post.astro`
2. `themes/<active-theme>/src/templates/default.astro`

## Creating a custom theme

1. Create a new folder: `themes/my-theme/`
2. Add `theme.yaml` with name and version
3. Add `package.json` with `"name": "@bldmrk/theme-my-theme"` and `"type": "module"`
4. Create `src/templates/default.astro` as the fallback template
5. Register the theme in `content/config/system.yaml`:

```yaml
theme: my-theme
```

### Minimal template example

```astro
---
// themes/my-theme/src/templates/default.astro
import type { PageObject } from '@bldmrk/core'

interface Props {
  page: PageObject
}

const { page } = Astro.props
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>{page.title}</title>
  </head>
  <body>
    <main set:html={page.html} />
  </body>
</html>
```

## Astro + Vue islands

The default theme uses Vue 3 for interactive components. Add a Vue island with the `client:` directive:

```astro
---
import SearchBox from '../components/SearchBox.vue'
---

<SearchBox client:load />
```

Available directives: `client:load`, `client:idle`, `client:visible`, `client:only`.
