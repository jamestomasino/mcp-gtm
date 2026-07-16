import { z } from "zod";
import { ParameterListSchema } from "./parameter";

/**
 * CustomTemplateSchema — represents a GTM custom template (tag, trigger, or variable template).
 */
export const CustomTemplateSchema = z.object({
  templateId: z.string(),
  fingerprint: z.string().optional(),
  name: z.string(),
  type: z.string(), // tag, trigger, variable
  field: z.array(z.any()).optional().default([]),
  iconRaw: z.string().optional(),
  subtitleRaw: z.string().optional(),
  editorScriptRaw: z.string().optional(),
  previewImageRaw: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export type CustomTemplate = z.infer<typeof CustomTemplateSchema>;
