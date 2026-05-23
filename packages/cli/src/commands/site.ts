import { defineCommand } from 'citty'
import { input, confirm } from '@inquirer/prompts'
import { consola } from 'consola'
import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'

// Inline until @bldmrk/core exports multisite module
interface SiteDefinition {
  domain: string
  aliases?: string[]
  contentDir?: string
}
interface MultisiteConfig {
  sites: SiteDefinition[]
  sharedPlugins: string[]
}

function getProjectDir(): string {
  return process.cwd()
}

async function readBldmrkConfig(): Promise<MultisiteConfig | null> {
  const configPath = path.join(getProjectDir(), 'bldmrk.config.yaml')
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    return yaml.load(raw) as MultisiteConfig
  } catch {
    return null
  }
}

const SITE_YAML_TEMPLATE = `title: "My Site"
description: ""
author: ""
language: en
url: ""
`

const SYSTEM_YAML_TEMPLATE = `# System configuration
cache:
  enabled: true
  ttl: 3600
build:
  dest: dist
`

export const siteCreateCommand = defineCommand({
  meta: { description: 'Create a new site in multi-site setup' },
  args: {
    domain: {
      type: 'positional',
      description: 'Domain for the new site (e.g. example.com)',
      required: true,
    },
  },
  async run({ args }) {
    const domain = args.domain
    const projectDir = getProjectDir()
    const siteDir = path.join(projectDir, 'sites', domain)
    const pagesDir = path.join(siteDir, 'content', 'pages')
    const configDir = path.join(siteDir, 'content', 'config')

    consola.start(`Creating site ${domain}...`)

    await fs.mkdir(pagesDir, { recursive: true })
    await fs.mkdir(configDir, { recursive: true })

    await fs.writeFile(path.join(configDir, 'site.yaml'), SITE_YAML_TEMPLATE.replace('My Site', domain))
    await fs.writeFile(path.join(configDir, 'system.yaml'), SYSTEM_YAML_TEMPLATE)

    consola.success(`Site ${domain} created at sites/${domain}/`)
    consola.info(`Next steps:`)
    consola.info(`  1. Edit sites/${domain}/content/config/site.yaml`)
    consola.info(`  2. Add your first page in sites/${domain}/content/pages/`)
  },
})

export const siteListCommand = defineCommand({
  meta: { description: 'List all configured sites' },
  async run() {
    const config = await readBldmrkConfig()

    if (!config) {
      consola.info('No multi-site config found (single-site mode)')
      return
    }

    const sites = config.sites ?? []
    if (sites.length === 0) {
      consola.info('No sites configured in bldmrk.config.yaml')
      return
    }

    console.log()
    const col = (s: string, w: number) => s.padEnd(w)
    console.log('  ' + col('Domain', 30) + col('Aliases', 30) + col('Content Dir', 30))
    console.log('  ' + '-'.repeat(90))
    for (const site of sites) {
      const aliases = (site.aliases ?? []).join(', ') || '-'
      const contentDir = site.contentDir ?? `sites/${site.domain}/content`
      console.log('  ' + col(site.domain, 30) + col(aliases, 30) + col(contentDir, 30))
    }
    console.log()
  },
})

export const siteBuildCommand = defineCommand({
  meta: { description: 'Build one or all sites' },
  args: {
    domain: {
      type: 'positional',
      description: 'Domain of the site to build (omit for all)',
      required: false,
    },
  },
  async run({ args }) {
    if (args.domain) {
      consola.info(`Would build site: ${args.domain}`)
      consola.info(`Run: pnpm build --site ${args.domain}`)
    } else {
      const config = await readBldmrkConfig()
      if (!config) {
        consola.info('No multi-site config found. Running single-site build.')
        consola.info('Run: pnpm build')
        return
      }
      const domains = config.sites.map((s) => s.domain)
      consola.info(`Would build all sites: ${domains.join(', ')}`)
      for (const domain of domains) {
        consola.info(`  → pnpm build --site ${domain}`)
      }
    }
  },
})

export const siteBackupCommand = defineCommand({
  meta: { description: 'Backup one or all sites' },
  args: {
    domain: {
      type: 'positional',
      description: 'Domain of the site to backup (omit for all)',
      required: false,
    },
  },
  async run({ args }) {
    if (args.domain) {
      consola.info(`Backup for ${args.domain}`)
    } else {
      consola.info('Backup for all sites')
    }
  },
})

export const siteMigrateCommand = defineCommand({
  meta: { description: 'Migrate single-site content/ to multi-site layout' },
  async run() {
    const projectDir = getProjectDir()
    const contentDir = path.join(projectDir, 'content')
    const configPath = path.join(projectDir, 'bldmrk.config.yaml')

    // Check preconditions
    let contentExists = false
    try {
      await fs.access(contentDir)
      contentExists = true
    } catch {
      contentExists = false
    }

    if (!contentExists) {
      consola.error('No content/ directory found in current directory.')
      return
    }

    let configExists = false
    try {
      await fs.access(configPath)
      configExists = true
    } catch {
      configExists = false
    }

    if (configExists) {
      consola.error('bldmrk.config.yaml already exists. This project may already be in multi-site mode.')
      return
    }

    // Prompt for domain
    const domain = await input({
      message: 'Enter your site domain:',
      validate: (v) => (v.trim().length > 0 ? true : 'Domain is required'),
    })

    const ok = await confirm({
      message: `This will move content/ to sites/${domain}/content/. Continue?`,
      default: false,
    })

    if (!ok) {
      consola.info('Migration cancelled.')
      return
    }

    consola.start('Migrating...')

    const targetDir = path.join(projectDir, 'sites', domain, 'content')
    await fs.mkdir(path.join(projectDir, 'sites', domain), { recursive: true })
    await fs.rename(contentDir, targetDir)

    const bldmrkConfig: MultisiteConfig = {
      sites: [{ domain }],
      sharedPlugins: [],
    }
    await fs.writeFile(configPath, yaml.dump(bldmrkConfig))

    consola.success(`Migration complete!`)
    consola.info(`Content moved to: sites/${domain}/content/`)
    consola.info(`bldmrk.config.yaml created with site: ${domain}`)
  },
})
