import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  integrations: [
    starlight({
      title: 'bldmrk',
      sidebar: [
        { label: 'Getting Started', link: '/getting-started' },
        { label: 'Content Format', link: '/content-format' },
        { label: 'Themes', link: '/themes' },
        { label: 'Plugins', link: '/plugins' },
        { label: 'CLI Reference', link: '/cli-reference' },
        { label: 'Deployment', link: '/deployment' },
      ],
    }),
  ],
})
