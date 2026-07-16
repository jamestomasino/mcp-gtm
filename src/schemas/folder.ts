import { z } from "zod";

/**
 * FolderSchema — represents a GTM folder (used to organize tags).
 */
export const FolderSchema = z.object({
  folderId: z.string(),
  fingerprint: z.string().optional(),
  name: z.string(),
  tagId: z.array(z.string()).optional().default([]),
  parentFolderId: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export type Folder = z.infer<typeof FolderSchema>;
