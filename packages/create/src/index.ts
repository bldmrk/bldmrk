#!/usr/bin/env node

import * as p from '@clack/prompts'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ProjectOptions {
  name: string
  description: string
  theme: string
  plugins: string[]
}

function replacePlaceholders(content: string, options: ProjectOptions): string {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, options.name)
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, options.description)
}

function copyTemplate(src: string, dest: string, options: ProjectOptions): void {
  mkdirSync(dest, { recursive: true })

  const entries = readdirSync(src)
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const stat = statSync(srcPath)

    if (stat.isDirectory()) {
      copyTemplate(srcPath, destPath, options)
    } else {
      const content = readFileSync(srcPath, 'utf-8')
      const replaced = replacePlaceholders(content, options)
      writeFileSync(destPath, replaced, 'utf-8')
    }
  }
}

async function main(): Promise<void> {
  p.intro('Welcome to bldmrk')

  const projectName = await p.text({
    message: 'Project name',
    placeholder: 'my-site',
    defaultValue: 'my-site',
    validate: (value: string) => {
      if (!value || value.trim().length === 0) return 'Project name is required'
      if (!/^[a-z0-9-_]+$/.test(value)) return 'Use only lowercase letters, numbers, hyphens, or underscores'
      return undefined
    },
  })

  if (p.isCancel(projectName)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const description = await p.text({
    message: 'Project description',
    placeholder: 'My bldmrk site',
    defaultValue: 'My bldmrk site',
  })

  if (p.isCancel(description)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const theme = await p.select({
    message: 'Select a theme',
    options: [
      { value: 'default', label: 'Default', hint: 'Astro-based starter theme' },
    ],
    initialValue: 'default',
  })

  if (p.isCancel(theme)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const plugins = await p.multiselect({
    message: 'Select plugins (space to toggle, enter to confirm)',
    options: [
      { value: 'seo', label: 'SEO', hint: 'Meta tags, Open Graph, sitemap' },
      { value: 'sitemap', label: 'Sitemap', hint: 'XML sitemap generation' },
      { value: 'rss', label: 'RSS', hint: 'RSS feed generation' },
    ],
    required: false,
  })

  if (p.isCancel(plugins)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }

  const options: ProjectOptions = {
    name: projectName as string,
    description: (description as string) || 'My bldmrk site',
    theme: theme as string,
    plugins: plugins as string[],
  }

  const targetDir = resolve(process.cwd(), options.name)
  const templateDir = join(__dirname, '..', 'templates', 'default')

  const spinner = p.spinner()
  spinner.start('Creating project...')

  try {
    copyTemplate(templateDir, targetDir, options)
    spinner.stop('Project files created.')
  } catch (err) {
    spinner.stop('Failed to copy template files.')
    p.log.error(String(err))
    process.exit(1)
  }

  spinner.start('Installing dependencies...')
  try {
    execFileSync('pnpm', ['install'], { cwd: targetDir, stdio: 'ignore' })
    spinner.stop('Dependencies installed.')
  } catch {
    spinner.stop('Could not run pnpm install — run it manually.')
  }

  p.outro(`
Project "${options.name}" is ready!

  cd ${options.name}
  bldmrk dev

  Admin UI:  http://localhost:3000/admin
  Public:    http://localhost:4322
  `)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
