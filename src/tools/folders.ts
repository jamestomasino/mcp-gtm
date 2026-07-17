import { z } from "zod";
import type { ContainerStore } from "../store";
import { textResult } from "../utils/response";

/** Folder tools (CRUD) */
export function registerFolderTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_folders",
      description:
        "List all folders in the container. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const folders = store.folders.map((folder) => ({
          folder_id: folder.folderId,
          name: folder.name,
          tag_ids: folder.tagId ?? [],
          tag_count: (folder.tagId ?? []).length,
          notes: folder.notes ?? null
        }));
        return textResult({ folders, total_count: folders.length });
      }
    },
    {
      name: "gtm_get_folder",
      description:
        "Get folder details and tag membership by folder_id or name. Requires a loaded container.",
      parameters: z.object({
        folder_id: z.string().optional().describe("Folder ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Folder name to look up (alternative to folder_id)")
      }),
      handler: async ({
        folder_id,
        name
      }: {
        folder_id?: string;
        name?: string;
      }) => {
        let folder;
        if (folder_id) {
          folder = store.folders.find((f) => f.folderId === folder_id);
        } else if (name) {
          folder = store.folders.find((f) => f.name === name);
        }
        if (!folder) {
          throw new Error(
            `Folder not found. Provided: folder_id=${folder_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult(folder);
      }
    },
    {
      name: "gtm_create_folder",
      description: "Create a new folder. Auto-assigns folderId.",
      parameters: z.object({
        name: z.string().describe("Folder name"),
        notes: z.string().optional().describe("Notes for the folder")
      }),
      handler: async ({ name, notes }: { name: string; notes?: string }) => {
        const folder = store.createFolder(name, notes);
        return textResult({ status: "created", folder });
      }
    },
    {
      name: "gtm_delete_folder",
      description: "Delete a folder from the container by folder_id.",
      parameters: z.object({
        folder_id: z.string().describe("Folder ID to delete")
      }),
      handler: async ({ folder_id }: { folder_id: string }) => {
        const deleted = store.deleteFolder(folder_id);
        if (!deleted) throw new Error(`Folder not found: ${folder_id}`);
        return textResult({ status: "deleted", folder_id });
      }
    },
    {
      name: "gtm_move_tag_to_folder",
      description:
        "Move a tag to a folder, or unassign it by setting folder_id to null.",
      parameters: z.object({
        tag_id: z.string().describe("Tag ID to move"),
        folder_id: z
          .string()
          .nullable()
          .describe("Target folder ID, or null to unassign from folder")
      }),
      handler: async ({
        tag_id,
        folder_id
      }: {
        tag_id: string;
        folder_id: string | null;
      }) => {
        const moved = store.moveTagToFolder(tag_id, folder_id);
        if (!moved) throw new Error(`Tag not found: ${tag_id}`);
        return textResult({ status: "moved", tag_id, folder_id });
      }
    },
    {
      name: "gtm_move_trigger_to_folder",
      description:
        "Move a trigger to a folder, or unassign it by setting folder_id to null.",
      parameters: z.object({
        trigger_id: z.string().describe("Trigger ID to move"),
        folder_id: z
          .string()
          .nullable()
          .describe("Target folder ID, or null to unassign from folder")
      }),
      handler: async ({
        trigger_id,
        folder_id
      }: {
        trigger_id: string;
        folder_id: string | null;
      }) => {
        const moved = store.moveTriggerToFolder(trigger_id, folder_id);
        if (!moved) throw new Error(`Trigger not found: ${trigger_id}`);
        return textResult({ status: "moved", trigger_id, folder_id });
      }
    },
    {
      name: "gtm_move_variable_to_folder",
      description:
        "Move a variable to a folder, or unassign it by setting folder_id to null.",
      parameters: z.object({
        variable_id: z.string().describe("Variable ID to move"),
        folder_id: z
          .string()
          .nullable()
          .describe("Target folder ID, or null to unassign from folder")
      }),
      handler: async ({
        variable_id,
        folder_id
      }: {
        variable_id: string;
        folder_id: string | null;
      }) => {
        const moved = store.moveVariableToFolder(variable_id, folder_id);
        if (!moved) throw new Error(`Variable not found: ${variable_id}`);
        return textResult({ status: "moved", variable_id, folder_id });
      }
    }
  ];
}
