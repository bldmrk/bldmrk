import { defineCommand } from 'citty'
import { input, password as passwordPrompt } from '@inquirer/prompts'
import { consola } from 'consola'
import { mkdir, writeFile, cp } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { UserStore } from '@bldmrk/core'
import { simpleGit } from 'simple-git'

function getStarterDir(): string {
  const thisFile = fileURLToPath(import.meta.url)
  // Resolves to packages/core/src/starter (dev) or dist/starter (prod)
  return path.join(path.dirname(thisFile), '..', '..', '..', 'core', 'src', 'starter')
}

function generateSecret(length = 64): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const initCommand = defineCommand({
  meta: { description: 'Scaffold a new bldmrk project' },
  args: {
    name: { type: 'positional', description: 'Project directory name', required: false },
    yes: { type: 'boolean', description: 'Skip prompts, use defaults', default: false },
  },
  async run({ args }) {
    const yes = args.yes as boolean

    const projectName = (args.name as string | undefined) ??
      (yes ? 'my-bldmrk-site' : await input({ message: 'Project name:', default: 'my-bldmrk-site' }))

    const siteName = yes ? projectName :
      await input({ message: 'Site title:', default: projectName })

    const adminEmail = yes ? 'admin@localhost' :
      await input({ message: 'Admin email:', default: 'admin@localhost' })

    const generatedPassword = generateSecret(16)
    const adminPassword = yes ? generatedPassword :
      await passwordPrompt({
        message: 'Admin password (min 8 chars):',
        validate: (v: string) => v.length >= 8 || 'At least 8 characters required',
      })

    const jwtSecret = generateSecret()
    const targetDir = path.resolve(process.cwd(), projectName)

    consola.start(`Creating project in ${targetDir}`)

    // Copy starter content
    await cp(getStarterDir(), targetDir, { recursive: true })

    // Patch site name in site.yaml
    const siteYamlPath = path.join(targetDir, 'content', 'config', 'site.yaml')
    const { readFile } = await import('fs/promises')
    const siteYaml = (await readFile(siteYamlPath, 'utf-8')).replace('My bldmrk Site', siteName)
    await writeFile(siteYamlPath, siteYaml)

    // Write .env
    await writeFile(path.join(targetDir, '.env'), [
      `JWT_SECRET=${jwtSecret}`,
      `PORT=3000`,
      `NODE_ENV=development`,
    ].join('\n') + '\n')

    // Write package.json
    await writeFile(path.join(targetDir, 'package.json'), JSON.stringify({
      name: projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: { dev: 'bldmrk dev', build: 'bldmrk build', start: 'bldmrk start' },
    }, null, 2) + '\n')

    // Write .gitignore
    await writeFile(path.join(targetDir, '.gitignore'), [
      'node_modules/', 'dist/', '.env', '*.log',
    ].join('\n') + '\n')

    // Create admin user
    await mkdir(path.join(targetDir, 'config'), { recursive: true })
    const userStore = new UserStore(path.join(targetDir, 'config', 'users.yaml'))
    await userStore.create({ email: adminEmail, password: adminPassword, role: 'admin' })
    consola.success('Admin user created')

    // Git init + initial commit
    const git = simpleGit(targetDir, { config: ['user.email=bldmrk@localhost', 'user.name=bldmrk'] })
    await git.init()
    await git.add('.')
    await git.commit('Initial commit')
    consola.success('Git repository initialized')

    consola.success(`Project created: ${projectName}`)
    consola.box([
      `Next steps:`,
      `  cd ${projectName}`,
      `  pnpm install`,
      `  bldmrk dev`,
      ``,
      `  Admin: http://localhost:3000/admin`,
      `  Email:    ${adminEmail}`,
      `  Password: ${adminPassword}`,
      ...(yes ? [``, `  ⚠  Save this password — it won't be shown again.`] : []),
    ].join('\n'))
  },
})
