---
title: CLI Reference
description: All bldmrk commands and their options.
---

## Installation

The `bldmrk` CLI is provided by the `@bldmrk/cli` package. It is automatically available when you create a project with `@bldmrk/create`.

To install globally:

```bash
npm install -g @bldmrk/cli
```

---

## bldmrk init

Initialise a new bldmrk project in the current directory.

```bash
bldmrk init [options]
```

| Option | Description |
|--------|-------------|
| `--name <name>` | Project name (defaults to current directory name) |
| `--theme <theme>` | Theme to use (default: `default`) |

**Example:**

```bash
mkdir my-site && cd my-site
bldmrk init --name my-site
```

---

## bldmrk dev

Start the development server with hot-reload.

```bash
bldmrk dev [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port <port>` | `3000` | Port for the core API and admin |
| `--host <host>` | `localhost` | Hostname to bind to |
| `--open` | — | Open browser on start |

**Example:**

```bash
bldmrk dev --port 8080 --open
```

Starts:
- Core API: `http://localhost:8080`
- Admin UI: `http://localhost:8080/admin`
- Public preview (Astro): `http://localhost:4322`

---

## bldmrk build

Build the static site for production.

```bash
bldmrk build [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--outDir <dir>` | `dist/` | Output directory |
| `--base <path>` | `/` | Base URL path |

**Example:**

```bash
bldmrk build --outDir public/
```

---

## bldmrk user

Manage admin users.

### bldmrk user add

```bash
bldmrk user add --email <email> --role <role>
```

| Option | Description |
|--------|-------------|
| `--email <email>` | User email address |
| `--role <role>` | `admin`, `editor`, or `viewer` |
| `--password <pw>` | Password (prompted if omitted) |

### bldmrk user remove

```bash
bldmrk user remove --email <email>
```

### bldmrk user list

```bash
bldmrk user list
```

Lists all users with their roles.

### bldmrk user passwd

```bash
bldmrk user passwd --email <email>
```

Prompts for a new password.

---

## bldmrk plugin

Manage plugins.

### bldmrk plugin add

```bash
bldmrk plugin add <package-name>
```

Installs the plugin package and registers it in `content/config/system.yaml`.

### bldmrk plugin remove

```bash
bldmrk plugin remove <package-name>
```

Removes the plugin and unregisters it from system.yaml.

### bldmrk plugin list

```bash
bldmrk plugin list
```

Lists all installed plugins and their versions.
