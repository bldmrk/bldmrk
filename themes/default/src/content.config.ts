import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const contentPagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/pages')

const frontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  template: z.string().default('default'),
  published: z.boolean().default(true),
  date: z.coerce.date().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  menu: z
    .object({
      visible: z.boolean().optional(),
      label: z.string().optional(),
      icon: z.string().optional(),
      order: z.number().optional(),
    })
    .optional(),
  routes: z
    .object({
      default: z.string().optional(),
      aliases: z.array(z.string()).optional(),
    })
    .optional(),
  i18n: z.record(z.string(), z.string()).optional(),
}).strip()

export const collections = {
  pages: defineCollection({
    loader: glob({
      pattern: '**/index.{md,mdx}',
      base: contentPagesDir,
    }),
    schema: frontmatterSchema,
  }),
}
