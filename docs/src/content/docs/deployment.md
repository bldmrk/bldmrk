---
title: Deployment
description: Deploy your bldmrk site to Netlify, Vercel, S3, or your own server.
---

## Overview

`bldmrk build` generates a fully static site in `dist/`. You can deploy this folder to any static host. For continuous deployment, use the Core API's **deploy hook** endpoint to trigger a rebuild and re-deploy automatically when content changes.

---

## Netlify

1. Connect your Git repository in the Netlify dashboard.
2. Set the build command: `bldmrk build`
3. Set the publish directory: `dist`
4. Add environment variables if needed (e.g. `NODE_VERSION=20`)

**Automatic rebuilds via webhook:**

```bash
# In content/config/system.yaml
deployHooks:
  - name: Netlify
    url: "https://api.netlify.com/build_hooks/<your-hook-id>"
    method: POST
```

The Core API will POST to this URL after every successful build when running `bldmrk dev`.

### netlify.toml example

```toml
[build]
  command = "bldmrk build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

---

## Vercel

1. Import your Git repository in the Vercel dashboard.
2. Override the build command: `bldmrk build`
3. Set the output directory: `dist`

**vercel.json example:**

```json
{
  "buildCommand": "bldmrk build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install"
}
```

**Automatic rebuilds via deploy hook:**

```yaml
# content/config/system.yaml
deployHooks:
  - name: Vercel
    url: "https://api.vercel.com/v1/integrations/deploy/<hook-id>"
    method: POST
```

---

## Amazon S3

Build the site and sync the output to an S3 bucket configured for static website hosting.

```bash
bldmrk build
aws s3 sync dist/ s3://my-bucket --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**Recommended bucket policy** (public read):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}
```

---

## Self-Hosting

For self-hosted deployments you can run the bldmrk Core API as a long-running process (e.g. managed by `systemd` or `pm2`) and serve the static output with Nginx or Caddy.

### Nginx example

```nginx
server {
  listen 80;
  server_name example.com;

  root /var/www/my-site/dist;
  index index.html;

  # Serve static files
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy Admin API
  location /api/ {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }

  location /admin {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }
}
```

### pm2 process file

```yaml
# ecosystem.config.yaml
apps:
  - name: bldmrk-cms
    script: bldmrk
    args: dev
    cwd: /var/www/my-site
    env:
      NODE_ENV: production
```

```bash
pm2 start ecosystem.config.yaml
pm2 save
pm2 startup
```
