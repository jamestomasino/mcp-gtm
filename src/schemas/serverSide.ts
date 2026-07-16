import { z } from "zod";
import { ParameterListSchema } from "./parameter";

/**
 * ZoneSchema — represents a GTM server-side container zone.
 */
export const ZoneSchema = z.object({
  zoneId: z.string(),
  fingerprint: z.string().optional(),
  name: z.string(),
  type: z.string(), // web_container, web_app, android_app, etc.
  parameter: ParameterListSchema.optional().default([]),
  parentFolderId: z.string().optional(),
  notes: z.string().optional(),
  workspaceId: z.string().optional(),
}).passthrough();

export type Zone = z.infer<typeof ZoneSchema>;

/**
 * ClientSchema — represents a GTM server-side client.
 */
export const ClientSchema = z.object({
  clientId: z.string(),
  fingerprint: z.string().optional(),
  name: z.string(),
  type: z.string(), // web_client, mobile_app_client, etc.
  parameter: ParameterListSchema.optional().default([]),
  notes: z.string().optional(),
}).passthrough();

export type Client = z.infer<typeof ClientSchema>;

/**
 * TransformationSchema — represents a GTM server-side transformation (tag routing rule).
 */
export const TransformationSchema = z.object({
  transformationId: z.string(),
  fingerprint: z.string().optional(),
  name: z.string(),
  type: z.string(),
  parameter: ParameterListSchema.optional().default([]),
  notes: z.string().optional(),
}).passthrough();

export type Transformation = z.infer<typeof TransformationSchema>;
