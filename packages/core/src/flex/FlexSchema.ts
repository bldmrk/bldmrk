import { z } from 'zod'

export interface FlexField {
  name: string
  type:
    | 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'image' | 'select' | 'list' | 'object'
    | 'markdown' | 'slug' | 'tags' | 'section' | 'template' | 'datetime' | 'file' | 'hidden'
  label: string
  required?: boolean
  default?: unknown
  options?: { value: string; label: string }[]
  fields?: FlexField[]
  source?: string
  condition?: { field: string; value: unknown }
  placeholder?: string
  help?: string
}

const FlexFieldSchema: z.ZodType<FlexField> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum([
      'text', 'textarea', 'number', 'boolean', 'date', 'image', 'select', 'list', 'object',
      'markdown', 'slug', 'tags', 'section', 'template', 'datetime', 'file', 'hidden',
    ]),
    label: z.string(),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    fields: z.array(FlexFieldSchema).optional(),
    source: z.string().optional(),
    condition: z.object({ field: z.string(), value: z.unknown() }).optional(),
    placeholder: z.string().optional(),
    help: z.string().optional(),
  }),
)

export { FlexFieldSchema }

export const FlexTypeSchema = z.object({
  name: z.string(),
  label: z.string(),
  labelField: z.string(),
  icon: z.string().optional(),
  public: z.boolean().default(false),
  fields: z.array(FlexFieldSchema),
  admin: z
    .object({
      list: z.array(z.string()).optional(),
      sort: z.string().optional(),
    })
    .optional(),
})

export type FlexType = z.infer<typeof FlexTypeSchema>

export interface FlexEntry {
  id: string
  typeName: string
  data: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}
