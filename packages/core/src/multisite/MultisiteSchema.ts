import { z } from 'zod'

export const SiteDefinitionSchema = z.object({
  domain: z.string(),
  aliases: z.array(z.string()).default([]),
  contentDir: z.string().optional(), // default: sites/{domain}/
})

export const MultisiteConfigSchema = z.object({
  sites: z.array(SiteDefinitionSchema),
  sharedPlugins: z.array(z.string()).default([]),
})

export type MultisiteConfig = z.infer<typeof MultisiteConfigSchema>
export type SiteDefinition = z.infer<typeof SiteDefinitionSchema>
