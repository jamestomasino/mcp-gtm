import { z } from "zod";
import { TagSchema } from "./tag";
import { TriggerSchema } from "./trigger";
import { VariableSchema, BuiltInVariableSchema } from "./variable";
import { FolderSchema } from "./folder";
import { ZoneSchema, ClientSchema, TransformationSchema } from "./serverSide";
import { CustomTemplateSchema } from "./customTemplate";

/**
 * ContainerSchema — represents the container inside a container version.
 */
export const ContainerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  usageContext: z.array(z.union([z.number(), z.string()])).optional(), // 1 = web, 2 = server, 3 = android, 4 = ios; also "WEB", "SERVER", etc.
  defaultTimezone: z.string().optional(),
  note: z.string().optional(),
  noteColor: z.string().optional(),
  tag: z.array(TagSchema).optional().default([]),
  trigger: z.array(TriggerSchema).optional().default([]),
  userDefinedVariable: z.array(VariableSchema).optional().default([]),
  folder: z.array(FolderSchema).optional().default([]),
  builtInVariable: z.array(BuiltInVariableSchema).optional().default([]),
  client: z.array(ClientSchema).optional().default([]),
  zone: z.array(ZoneSchema).optional().default([]),
  transformation: z.array(TransformationSchema).optional().default([]),
  customTemplate: z.array(CustomTemplateSchema).optional().default([]),
  gtagConfig: z.array(z.any()).optional().default([]),
}).passthrough();

export type Container = z.infer<typeof ContainerSchema>;
