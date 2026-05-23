import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { UserStore } from '@bldmrk/core'

export default async function globalSetup() {
  const tmpDir = process.env.FOLIO_E2E_TMP_DIR
  if (!tmpDir) throw new Error('FOLIO_E2E_TMP_DIR not set')

  const contentDir = path.join(tmpDir, 'content')
  const configDir = path.join(contentDir, 'config')
  const pagesDir = path.join(contentDir, 'pages')
  const mediaDir = path.join(contentDir, 'media')

  await mkdir(configDir, { recursive: true })
  await mkdir(path.join(pagesDir, '001--home'), { recursive: true })
  await mkdir(path.join(pagesDir, '002--about'), { recursive: true })
  await mkdir(mediaDir, { recursive: true })

  await writeFile(path.join(configDir, 'site.yaml'), 'name: E2E Test Site\nurl: http://localhost:5173\n')
  await writeFile(path.join(configDir, 'system.yaml'), 'port: 3000\nadminPath: /admin\nlogLevel: error\ncors:\n  origins: []\n')

  await writeFile(path.join(pagesDir, '001--home', 'index.mdx'), '# Home\n\nWelcome to the E2E test site.\n')
  await writeFile(path.join(pagesDir, '001--home', 'page.yaml'), 'title: Home\ntemplate: default\npublished: true\n')
  await writeFile(path.join(pagesDir, '002--about', 'index.mdx'), '# About\n\nAbout page.\n')
  await writeFile(path.join(pagesDir, '002--about', 'page.yaml'), 'title: About\ntemplate: default\npublished: true\n')

  const userStore = new UserStore(path.join(configDir, 'users.yaml'))
  await userStore.create({ email: 'admin@test.com', password: 'test1234', role: 'admin' })
}
