import { defineCommand } from 'citty'
import { input, select } from '@inquirer/prompts'
import { consola } from 'consola'
import { mkdir, writeFile, readdir, readFile } from 'fs/promises'
import path from 'path'
import { FrontmatterSchema, PageLoader } from '@bldmrk/core'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'

const FOLDER_RE = /^(\d+)--(.+)$/

export const pagesListCommand = defineCommand({
  meta: { description: 'List all pages' },
  async run() {
    const pagesDir = path.join(process.cwd(), 'content', 'pages')
    const loader = new PageLoader(pagesDir)
    const pages = await loader.loadAll()

    if (pages.length === 0) {
      consola.info('No pages found.')
      return
    }

    console.log('\n  Slug'.padEnd(30) + 'Title'.padEnd(40) + 'Template'.padEnd(20) + 'Published')
    console.log('  ' + '-'.repeat(85))
    for (const page of pages) {
      console.log([
        ('  ' + page.slug).padEnd(30),
        (page.meta.title ?? '').padEnd(40),
        (page.meta.template ?? '').padEnd(20),
        String(page.meta.published ?? false),
      ].join(''))
    }
    console.log()
  },
})

export const pagesCreateCommand = defineCommand({
  meta: { description: 'Create a new page interactively' },
  args: {
    path: { type: 'positional', description: 'Page slug', required: false },
  },
  async run({ args }) {
    const slug = (args.path as string | undefined) ?? await input({ message: 'Page slug:' })
    const title = await input({ message: 'Title:', default: slug })
    const template = await select({
      message: 'Template:',
      choices: [
        { value: 'default', name: 'Default' },
        { value: 'blog', name: 'Blog post' },
        { value: 'landing', name: 'Landing page' },
      ],
    })

    const pagesDir = path.join(process.cwd(), 'content', 'pages')
    const entries = await readdir(pagesDir).catch(() => [] as string[])
    const orders = entries
      .map(e => { const m = FOLDER_RE.exec(e); return m ? parseInt(m[1]!, 10) : null })
      .filter((n): n is number => n !== null)
    const order = orders.length === 0 ? 1 : Math.max(...orders) + 1
    const folderPath = path.join(pagesDir, `${String(order).padStart(3, '0')}--${slug}`)

    await mkdir(folderPath, { recursive: true })
    await writeFile(path.join(folderPath, 'index.mdx'), `# ${title}\n`, 'utf-8')
    await writeFile(path.join(folderPath, 'page.yaml'), dumpYaml({ title, template, published: false }), 'utf-8')

    consola.success(`Page created: content/pages/${String(order).padStart(3, '0')}--${slug}/`)
  },
})

export const pagesValidateCommand = defineCommand({
  meta: { description: 'Validate all page.yaml files against FrontmatterSchema' },
  async run() {
    const pagesDir = path.join(process.cwd(), 'content', 'pages')
    const entries = await readdir(pagesDir).catch(() => [] as string[])
    const pageFolders = entries.filter(e => FOLDER_RE.test(e))

    let errorCount = 0
    for (const folder of pageFolders) {
      const yamlPath = path.join(pagesDir, folder, 'page.yaml')
      try {
        const content = await readFile(yamlPath, 'utf-8')
        const data = loadYaml(content)
        const result = FrontmatterSchema.safeParse(data)
        if (!result.success) {
          consola.error(`${folder}/page.yaml:`)
          for (const issue of result.error.issues) {
            consola.error(`  ${issue.path.join('.')}: ${issue.message}`)
          }
          errorCount++
        }
      } catch {
        // no page.yaml — schema defaults apply, skip
      }
    }

    if (errorCount === 0) {
      consola.success(`All ${pageFolders.length} pages valid.`)
    } else {
      consola.error(`${errorCount} page(s) have validation errors.`)
      process.exit(1)
    }
  },
})
