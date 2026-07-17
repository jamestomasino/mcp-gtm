import { z } from "zod";
import type { Tag } from "../schemas/tag";
import type { ContainerStore } from "../store";
import { resolveFolderName, resolveTriggerNames } from "../utils/entity";
import { textResult } from "../utils/response";
import { getTagTypeName } from "../utils/typeCodes";

/** Tag tools (CRUD + search) */
export function registerTagTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_tags",
      description:
        "List all tags with summary info (name, type, enabled, folder). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const tags = store.tags.map((tag) => ({
          tag_id: tag.tagId,
          name: tag.name,
          type: tag.type,
          type_name: getTagTypeName(tag.type),
          enabled: tag.enabled !== false,
          folder_id: tag.parentFolderId ?? null,
          folder_name: resolveFolderName(tag.parentFolderId, store.folders),
          notes: tag.notes ?? null
        }));
        return textResult({ tags, total_count: tags.length });
      }
    },
    {
      name: "gtm_get_tag",
      description:
        "Get full tag configuration by tag_id or name. Requires a loaded container.",
      parameters: z.object({
        tag_id: z.string().optional().describe("Tag ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Tag name to look up (alternative to tag_id)")
      }),
      handler: async ({ tag_id, name }: { tag_id?: string; name?: string }) => {
        let tag;
        if (tag_id) {
          tag = store.tags.find((t) => t.tagId === tag_id);
        } else if (name) {
          tag = store.tags.find((t) => t.name === name);
        }
        if (!tag) {
          throw new Error(
            `Tag not found. Provided: tag_id=${tag_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult({
          ...tag,
          type_name: getTagTypeName(tag.type),
          folder_name: resolveFolderName(tag.parentFolderId, store.folders),
          firing_trigger_names: resolveTriggerNames(
            tag.firingTriggerId ?? [],
            store.triggers
          ),
          blocking_trigger_names: resolveTriggerNames(
            tag.blockingTriggerId ?? [],
            store.triggers
          )
        });
      }
    },
    {
      name: "gtm_create_tag",
      description:
        "Create a new tag. Validates against GTM schema, auto-assigns tagId if not provided.",
      parameters: z.object({
        name: z.string().describe("Tag name"),
        type: z
          .string()
          .describe(
            "Tag type code (e.g. gaawe for GA4, googtag for Google Tag, html for Custom HTML)"
          ),
        folder_id: z.string().optional().describe("Parent folder ID"),
        notes: z.string().optional().describe("Notes for the tag"),
        enabled: z
          .boolean()
          .optional()
          .describe("Whether the tag is enabled (default: true)")
      }),
      handler: async (params: Record<string, unknown>) => {
        const tag = store.createTag({
          name: params.name,
          type: params.type,
          parentFolderId: params.folder_id,
          notes: params.notes,
          enabled: params.enabled !== false
        });
        return textResult({
          status: "created",
          tag,
          type_name: getTagTypeName(tag.type)
        });
      }
    },
    {
      name: "gtm_update_tag",
      description: "Update an existing tag by tag_id.",
      parameters: z.object({
        tag_id: z.string().describe("Tag ID to update"),
        name: z.string().optional().describe("New tag name"),
        folder_id: z.string().optional().describe("New parent folder ID"),
        notes: z.string().optional().describe("New notes"),
        enabled: z.boolean().optional().describe("Enable or disable the tag")
      }),
      handler: async ({
        tag_id,
        ...updates
      }: {
        tag_id: string;
        [key: string]: unknown;
      }) => {
        const updatesObj: Record<string, string | boolean> = {};
        if (updates.name !== undefined)
          updatesObj.name = updates.name as string;
        if (updates.folder_id !== undefined)
          updatesObj.parentFolderId = updates.folder_id as string;
        if (updates.notes !== undefined)
          updatesObj.notes = updates.notes as string;
        if (updates.enabled !== undefined)
          updatesObj.enabled = updates.enabled as boolean;
        const tag = store.updateTag(tag_id, updatesObj as Partial<Tag>);
        return textResult({ status: "updated", tag });
      }
    },
    {
      name: "gtm_delete_tag",
      description: "Delete a tag from the container by tag_id.",
      parameters: z.object({
        tag_id: z.string().describe("Tag ID to delete")
      }),
      handler: async ({ tag_id }: { tag_id: string }) => {
        const deleted = store.deleteTag(tag_id);
        if (!deleted) throw new Error(`Tag not found: ${tag_id}`);
        return textResult({ status: "deleted", tag_id });
      }
    },
    {
      name: "gtm_find_tags_by_type",
      description:
        "Find tags by type code (e.g. gaawe, googtag, html). Requires a loaded container.",
      parameters: z.object({
        type: z.string().describe("Tag type code to search for")
      }),
      handler: async ({ type }: { type: string }) => {
        const matched = store.tags
          .filter((t) => t.type === type)
          .map((t) => ({
            tag_id: t.tagId,
            name: t.name,
            type: t.type,
            type_name: getTagTypeName(t.type),
            enabled: t.enabled !== false
          }));
        return textResult({
          type,
          type_name: getTagTypeName(type),
          tags: matched,
          total_count: matched.length
        });
      }
    }
  ];
}
