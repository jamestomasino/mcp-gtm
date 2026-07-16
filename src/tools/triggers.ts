import { z } from "zod";
import type { ContainerStore } from "../store";
import { resolveFolderName } from "../utils/entity";
import { getTriggerTypeName } from "../utils/typeCodes";

/** Trigger tools (CRUD) */
export function registerTriggerTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_triggers",
      description: "List all triggers with summary info (name, type, folder). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const triggers = store.triggers.map((trigger) => ({
          trigger_id: trigger.triggerId,
          name: trigger.name,
          type: trigger.type,
          type_name: getTriggerTypeName(trigger.type),
          folder_id: trigger.parentFolderId ?? null,
          folder_name: resolveFolderName(trigger.parentFolderId, store.folders),
          notes: trigger.notes ?? null,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ triggers, total_count: triggers.length }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_get_trigger",
      description: "Get full trigger configuration by trigger_id or name. Requires a loaded container.",
      parameters: z.object({
        trigger_id: z.string().optional().describe("Trigger ID to look up"),
        name: z.string().optional().describe("Trigger name to look up (alternative to trigger_id)"),
      }),
      handler: async ({ trigger_id, name }: { trigger_id?: string; name?: string }) => {
        let trigger;
        if (trigger_id) {
          trigger = store.triggers.find((t) => t.triggerId === trigger_id);
        } else if (name) {
          trigger = store.triggers.find((t) => t.name === name);
        }
        if (!trigger) {
          throw new Error(`Trigger not found. Provided: trigger_id=${trigger_id ?? "none"}, name=${name ?? "none"}`);
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            ...trigger,
            type_name: getTriggerTypeName(trigger.type),
            folder_name: resolveFolderName(trigger.parentFolderId, store.folders),
          }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_create_trigger",
      description: "Create a new trigger. Validates against GTM schema, auto-assigns triggerId if not provided.",
      parameters: z.object({
        name: z.string().describe("Trigger name"),
        type: z.string().describe("Trigger type code (e.g. pageview, click, custom, scroll, timer)"),
        folder_id: z.string().optional().describe("Parent folder ID"),
        notes: z.string().optional().describe("Notes for the trigger"),
      }),
      handler: async (params: Record<string, unknown>) => {
        const trigger = store.createTrigger({
          name: params.name,
          type: params.type,
          parentFolderId: params.folder_id,
          notes: params.notes,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            status: "created",
            trigger,
            type_name: getTriggerTypeName(trigger.type),
          }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_update_trigger",
      description: "Update an existing trigger by trigger_id.",
      parameters: z.object({
        trigger_id: z.string().describe("Trigger ID to update"),
        name: z.string().optional().describe("New trigger name"),
        folder_id: z.string().optional().describe("New parent folder ID"),
        notes: z.string().optional().describe("New notes"),
      }),
      handler: async ({ trigger_id, ...updates }: { trigger_id: string; [key: string]: unknown }) => {
        const trigger = store.updateTrigger(trigger_id, {
          ...(updates.name !== undefined && { name: updates.name as string }),
          ...(updates.folder_id !== undefined && { parentFolderId: updates.folder_id as string }),
          ...(updates.notes !== undefined && { notes: updates.notes as string }),
        } as any);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "updated", trigger }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_delete_trigger",
      description: "Delete a trigger from the container by trigger_id.",
      parameters: z.object({
        trigger_id: z.string().describe("Trigger ID to delete"),
      }),
      handler: async ({ trigger_id }: { trigger_id: string }) => {
        const deleted = store.deleteTrigger(trigger_id);
        if (!deleted) throw new Error(`Trigger not found: ${trigger_id}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "deleted", trigger_id }, null, 2) }],
        };
      },
    },
  ];
}
