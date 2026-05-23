import { z } from 'zod'

export const FrontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  template: z.string().default('default'),
  published: z.boolean().default(true),
  date: z.coerce.date().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  menu: z.object({
    visible: z.boolean().optional(),
    label: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().optional(),
  }).optional(),
  routes: z.object({
    default: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  }).optional(),
  i18n: z.record(z.string(), z.string()).optional(),
}).strip()

export type Frontmatter = z.infer<typeof FrontmatterSchema>
