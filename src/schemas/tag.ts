import { z } from "zod";
import { ParameterListSchema } from "./parameter";

/**
 * TagSchema — represents a GTM tag.
 * Adapted from stape-io Zod schemas for the export JSON shape.
 */
export const TagSchema = z
  .object({
    tagId: z.string(),
    fingerprint: z.string().optional(),
    name: z.string(),
    type: z.string(), // gaawe, googtag, html, ua, awct, img, cvt_*, etc.
    enabled: z.boolean().optional().default(true),
    parameter: ParameterListSchema,
    firingTriggerId: z.array(z.string()).optional().default([]),
    blockingTriggerId: z.array(z.string()).optional().default([]),
    blockingTagId: z.array(z.string()).optional().default([]),
    parentFolderId: z.string().optional(),
    tagsAwaitingSupport: z.boolean().optional(),
    checkValidationMessage: z.boolean().optional(),
    googleAnalyticsFinalField: z.string().optional(),
    googleAnalyticsFinalHash: z.string().optional(),
    notes: z.string().optional(),
    parentContainerId: z.string().optional(),
    schedule: z.array(z.any()).optional(),
    consentSettings: z
      .object({
        consentStatus: z.string().optional(), // "NOT_NEEDED", "NEEDED", "DENIED", "GRANTED"
        consentMode: z.string().optional(), // "V2"
        consentType: z.any().optional() // list of consent types (e.g. ["analytics_storage"])
      })
      .optional()
  })
  .passthrough();

export type Tag = z.infer<typeof TagSchema>;
