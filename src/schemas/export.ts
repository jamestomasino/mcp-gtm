import { z } from "zod";
import { ContainerSchema } from "./container";

/**
 * ContainerVersionSchema — wraps a container with account/container metadata.
 */
export const ContainerVersionSchema = z
  .object({
    accountId: z.string(),
    containerId: z.string(),
    containerVersionId: z.string().optional(),
    fingerprint: z.string().optional(),
    tagManagerUrl: z.string().optional(),
    container: ContainerSchema
    // Allow additional fields from the export that aren't part of the core schema
  })
  .passthrough();

/**
 * GtmExportSchema — the top-level shape of a GTM export JSON file.
 */
export const GtmExportSchema = z
  .object({
    exportTime: z.string().optional(),
    containerVersion: ContainerVersionSchema
  })
  .passthrough();

export type ContainerVersion = z.infer<typeof ContainerVersionSchema>;
export type GtmExport = z.infer<typeof GtmExportSchema>;
