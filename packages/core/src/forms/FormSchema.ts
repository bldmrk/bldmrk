import { z } from 'zod'

export const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'email', 'textarea', 'select', 'checkbox', 'radio', 'hidden', 'file']),
  label: z.string(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
})

export const FormBlueprintSchema = z.object({
  name: z.string(),
  fields: z.array(FieldSchema),
  actions: z.object({
    email: z.object({
      to: z.string().email(),
      from: z.string().email().optional(),
      subject: z.string().default('New Form Submission'),
      replyTo: z.string().optional(),
    }).optional(),
    save: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('content/data/forms'),
    }).optional(),
    webhook: z.object({
      url: z.string().url(),
      method: z.enum(['POST', 'PUT']).default('POST'),
      headers: z.record(z.string(), z.string()).optional(),
    }).optional(),
    redirect: z.string().optional(),
  }),
  honeypot: z.string().default('_gotcha'),
  rateLimit: z.number().int().default(5),
})

export type FormBlueprint = z.infer<typeof FormBlueprintSchema>
export type FormField = z.infer<typeof FieldSchema>
