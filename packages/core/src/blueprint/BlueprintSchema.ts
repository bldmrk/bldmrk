import { z } from 'zod'
import { FlexFieldSchema, type FlexField } from '../flex/FlexSchema.js'

export type BlueprintField = FlexField

export const BlueprintTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  fields: z.array(FlexFieldSchema),
})

export type BlueprintTab = z.infer<typeof BlueprintTabSchema>

export const BlueprintDefinitionSchema = z
  .object({
    name: z.string(),
    label: z.string(),
    extends: z.string().optional(),
    tabs: z.array(BlueprintTabSchema).optional(),
    fields: z.array(FlexFieldSchema).optional(),
  })
  .refine(
    (d) => (d.tabs !== undefined) !== (d.fields !== undefined),
    { message: 'Blueprint must have either "tabs" or "fields", not both and not neither' },
  )

export type BlueprintDefinition = z.infer<typeof BlueprintDefinitionSchema>
