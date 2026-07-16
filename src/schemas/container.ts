import { z } from "zod";
import { TagSchema } from "./tag";
import { TriggerSchema } from "./trigger";
import { VariableSchema, BuiltInVariableSchema } from "./variable";
import { FolderSchema } from "./folder";

/**
 * ContainerSchema — represents the container inside a container version.
 */
export const ContainerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  usageContext: z.array(z.number()).optional(), // 1 = web, 2 = server, 3 = android, 4 = ios
  defaultTimezone: z.string().optional(),
  note: z.string().optional(),
  noteColor: z.string().optional(),
  tag: z.array(TagSchema).optional().default([]),
  trigger: z.array(TriggerSchema).optional().default([]),
  userDefinedVariable: z.array(VariableSchema).optional().default([]),
  folder: z.array(FolderSchema).optional().default([]),
  builtInVariable: z.array(BuiltInVariableSchema).optional().default([]),
  client: z.array(z.any()).optional().default([]),
  zone: z.array(z.any()).optional().default([]),
  transformation: z.array(z.any()).optional().default([]),
  customTemplate: z.array(z.any()).optional().default([]),
  gtagConfig: z.array(z.any()).optional().default([]),
}).passthrough();

export type Container = z.infer<typeof ContainerSchema>;
