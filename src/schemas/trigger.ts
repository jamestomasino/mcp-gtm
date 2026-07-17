import { z } from "zod";
import { ConditionListSchema } from "./condition";
import { ParameterListSchema } from "./parameter";

/**
 * TriggerSchema — represents a GTM trigger.
 */
export const TriggerSchema = z
  .object({
    triggerId: z.string(),
    fingerprint: z.string().optional(),
    name: z.string(),
    type: z.string(), // pageview, click, form, scroll, timer, custom, historyChange, domReady, error
    filter: ConditionListSchema,
    parameter: ParameterListSchema,
    checkingFireRate: z.string().optional(), // all, limit
    fireRateLimit: z.number().optional(),
    parentFolderId: z.string().optional(),
    notes: z.string().optional()
  })
  .passthrough();

export type Trigger = z.infer<typeof TriggerSchema>;
