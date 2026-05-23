# Multi-Site / Multi-Tenant

## Overview

bldmrk supports running multiple independent websites from a single installation. In multi-site mode, each site has its own content directory, configuration, and URL namespace. Sites share the same bldmrk process and plugin ecosystem but have no shared content or state.

Use multi-site mode when you:
- Manage several distinct websites for a client or organization
- Need per-site content isolation with shared infrastructure
- Want a single admin hub to orchestrate builds and backups across sites

Single-site mode remains the default. Multi-site mode is opt-in via `bldmrk.config.yaml`.

---

## Directory Structure

```
my-project/
├── bldmrk.config.yaml          # Multi-site configuration (enables multi-site mode)
├── sites/
│   ├── example.com/
│   │   └── content/
│   │       ├── pages/
│   │       ├── media/
│   │       └── config/
│   │           ├── site.yaml
│   │           └── system.yaml
│   └── shop.example.com/
│       └── content/
│           ├── pages/
│           ├── media/
│           └── config/
│               ├── site.yaml
│               └── system.yaml
├── plugins/                   # Shared plugins (optional)
└── package.json
```

Each site under `sites/` is fully self-contained. The `content/` subfolder has the same structure as a single-site project.

---

## Configuration

`bldmrk.config.yaml` is the multi-site configuration file placed in the project root.

```yaml
sites:
  - domain: example.com
    aliases:
      - www.example.com
    contentDir: sites/example.com/content   # optional, inferred from domain if omitted

  - domain: shop.example.com
    aliases: []
    contentDir: sites/shop.example.com/content

sharedPlugins:
  - bldmrk-plugin-seo
  - bldmrk-plugin-sitemap
```

| Field | Required | Description |
|-------|----------|-------------|
| `sites[].domain` | Yes | Primary domain for the site |
| `sites[].aliases` | No | Additional hostnames that route to this site |
| `sites[].contentDir` | No | Custom path to the site's content directory |
| `sharedPlugins` | No | Plugin package names loaded for every site |

---

## Getting Started

### Create your first site

```bash
bldmrk site:create example.com
```

This creates:
- `sites/example.com/content/pages/`
- `sites/example.com/content/config/site.yaml`
- `sites/example.com/content/config/system.yaml`

Then add your site to `bldmrk.config.yaml`:

```yaml
sites:
  - domain: example.com
sharedPlugins: []
```

### Add more sites

```bash
bldmrk site:create shop.example.com
```

Add the new entry to `bldmrk.config.yaml`, then start editing content in `sites/shop.example.com/content/pages/`.

### List configured sites

```bash
bldmrk site:list
```

Output:

```
  Domain                         Aliases                        Content Dir
  ------------------------------------------------------------------------------------------
  example.com                    www.example.com                sites/example.com/content
  shop.example.com               -                              sites/shop.example.com/content
```

---

## Migration from Single-Site

If you have an existing single-site project and want to convert it to multi-site, use:

```bash
bldmrk site:migrate
```

The command will:
1. Detect your existing `content/` directory
2. Ask for your primary domain
3. Move `content/` to `sites/<domain>/content/`
4. Create a minimal `bldmrk.config.yaml`

Example session:

```
? Enter your site domain: example.com
? This will move content/ to sites/example.com/content/. Continue? (y/N) y

Migration complete!
Content moved to: sites/example.com/content/
bldmrk.config.yaml created with site: example.com
```

After migration, commit all changes and restart the dev server.

---

## Virtual Hosting with Nginx

Route incoming requests to the correct site by domain using Nginx:

```nginx
# example.com → port 3000 (bldmrk handles site selection by Host header)
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name shop.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

bldmrk reads the `Host` header to select the matching site configuration from `bldmrk.config.yaml`. Both sites can share the same port.

For TLS, use Certbot to obtain certificates and add `ssl_certificate` directives as usual.

---

## Docker Compose Example

```yaml
version: "3.9"

services:
  bldmrk:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      FOLIO_HUB_TOKEN: ${FOLIO_HUB_TOKEN}
    command: ["node", "packages/cli/dist/index.js", "dev"]
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - bldmrk
    restart: unless-stopped
```

Set `FOLIO_HUB_TOKEN` in a `.env` file (never commit this value).

---

## Hub Admin Dashboard

The Hub Admin is a lightweight SPA served at `/__hub/` that provides a centralized view of all configured sites.

### Accessing the Hub

1. Set the `FOLIO_HUB_TOKEN` environment variable before starting bldmrk:

   ```bash
   export FOLIO_HUB_TOKEN=your-secure-random-token
   bldmrk dev
   ```

2. Navigate to `http://localhost:3000/__hub/` in your browser.

3. Enter your hub token when prompted. The token is stored in `localStorage` for the session.

### Hub Features

| Feature | Description |
|---------|-------------|
| Site list | Shows all sites with domain, aliases, and content directory |
| Trigger build | Starts an incremental build for a specific site |
| Trigger backup | Creates a backup of a site's content |

### Hub API

The Hub exposes a minimal REST API under `/__hub/api/`. All requests require the `X-Hub-Token` header:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/__hub/api/sites` | List all configured sites |
| `POST` | `/__hub/api/sites/:id/build` | Trigger a build for site `:id` |
| `POST` | `/__hub/api/sites/:id/backup` | Trigger a backup for site `:id` |

---

## Architecture Notes

- **Process isolation**: All sites run inside the same bldmrk Node.js process. Site selection happens at the request level via the `Host` header.
- **Content isolation**: Each site reads and writes only its own `contentDir`. There is no cross-site content sharing.
- **Plugin sharing**: Plugins listed in `sharedPlugins` are loaded once and applied to every site. Per-site plugins can be specified in the site's `system.yaml`.
- **Cache isolation**: Each site maintains its own page cache namespace to prevent cache poisoning between sites.
- **Build isolation**: Builds are queued per-site. A content change in `example.com` does not trigger a rebuild of `shop.example.com`.
- **No shared state**: Sites do not share in-memory state, user sessions, or search indexes.
