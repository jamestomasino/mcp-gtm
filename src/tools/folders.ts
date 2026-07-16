import { z } from "zod";
import type { ContainerStore } from "../store";

/** Folder tools (CRUD) */
export function registerFolderTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_folders",
      description: "List all folders in the container. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const folders = store.folders.map((folder) => ({
          folder_id: folder.folderId,
          name: folder.name,
          tag_ids: folder.tagId ?? [],
          tag_count: (folder.tagId ?? []).length,
          notes: folder.notes ?? null,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ folders, total_count: folders.length }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_get_folder",
      description: "Get folder details and tag membership by folder_id or name. Requires a loaded container.",
      parameters: z.object({
        folder_id: z.string().optional().describe("Folder ID to look up"),
        name: z.string().optional().describe("Folder name to look up (alternative to folder_id)"),
      }),
      handler: async ({ folder_id, name }: { folder_id?: string; name?: string }) => {
        let folder;
        if (folder_id) {
          folder = store.folders.find((f) => f.folderId === folder_id);
        } else if (name) {
          folder = store.folders.find((f) => f.name === name);
        }
        if (!folder) {
          throw new Error(`Folder not found. Provided: folder_id=${folder_id ?? "none"}, name=${name ?? "none"}`);
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(folder, null, 2) }],
        };
      },
    },
    {
      name: "gtm_create_folder",
      description: "Create a new folder. Auto-assigns folderId.",
      parameters: z.object({
        name: z.string().describe("Folder name"),
        notes: z.string().optional().describe("Notes for the folder"),
      }),
      handler: async ({ name, notes }: { name: string; notes?: string }) => {
        const folder = store.createFolder(name, notes);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "created", folder }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_delete_folder",
      description: "Delete a folder from the container by folder_id.",
      parameters: z.object({
        folder_id: z.string().describe("Folder ID to delete"),
      }),
      handler: async ({ folder_id }: { folder_id: string }) => {
        const deleted = store.deleteFolder(folder_id);
        if (!deleted) throw new Error(`Folder not found: ${folder_id}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "deleted", folder_id }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_move_tag_to_folder",
      description: "Move a tag to a folder, or unassign it by setting folder_id to null.",
      parameters: z.object({
        tag_id: z.string().describe("Tag ID to move"),
        folder_id: z.string().nullable().describe("Target folder ID, or null to unassign from folder"),
      }),
      handler: async ({ tag_id, folder_id }: { tag_id: string; folder_id: string | null }) => {
        const moved = store.moveTagToFolder(tag_id, folder_id);
        if (!moved) throw new Error(`Tag not found: ${tag_id}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "moved", tag_id, folder_id }, null, 2) }],
        };
      },
    },
  ];
}
