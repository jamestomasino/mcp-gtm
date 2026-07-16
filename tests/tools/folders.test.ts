import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerFolderTools } from "../../src/tools/folders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Folder tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerFolderTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerFolderTools(store);
  });

  describe("gtm_list_folders", () => {
    it("should return all folders", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_folders")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.total_count).toBe(2);
      expect(text.folders[0]).toHaveProperty("folder_id");
      expect(text.folders[0]).toHaveProperty("tag_count");
      expect(text.folders[0]).toHaveProperty("tag_ids");
    });
  });

  describe("gtm_get_folder", () => {
    it("should find folder by folder_id", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_folder")!.handler({ folder_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.folderId).toBe("1");
    });

    it("should find folder by name", async () => {
      const folders = store.folders;
      const folderName = folders[0].name;
      const result = await tools.find((t) => t.name === "gtm_get_folder")!.handler({ name: folderName });
      const text = JSON.parse(result.content[0].text);
      expect(text.name).toBe(folderName);
    });

    it("should throw when folder not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_folder")!;
      await expect(tool.handler({ folder_id: "999" })).rejects.toThrow("Folder not found");
    });
  });

  describe("gtm_create_folder", () => {
    it("should create a folder with auto-assigned ID", async () => {
      const result = await tools.find((t) => t.name === "gtm_create_folder")!.handler({
        name: "New Folder",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("created");
      expect(text.folder.folderId).toBeDefined();
      expect(text.folder.name).toBe("New Folder");
    });

    it("should create a folder with notes", async () => {
      const result = await tools.find((t) => t.name === "gtm_create_folder")!.handler({
        name: "Folder With Notes",
        notes: "This is a test folder",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.folder.notes).toBe("This is a test folder");
    });
  });

  describe("gtm_delete_folder", () => {
    it("should delete a folder", async () => {
      const result = await tools.find((t) => t.name === "gtm_delete_folder")!.handler({ folder_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("deleted");
      expect(store.folders.find((f) => f.folderId === "1")).toBeUndefined();
    });

    it("should throw when folder not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_delete_folder")!;
      await expect(tool.handler({ folder_id: "999" })).rejects.toThrow("Folder not found");
    });
  });

  describe("gtm_move_tag_to_folder", () => {
    it("should move a tag to a folder", async () => {
      const result = await tools.find((t) => t.name === "gtm_move_tag_to_folder")!.handler({
        tag_id: "1",
        folder_id: "1",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("moved");
      expect(text.tag_id).toBe("1");
      expect(text.folder_id).toBe("1");
    });

    it("should unassign a tag from folder", async () => {
      const result = await tools.find((t) => t.name === "gtm_move_tag_to_folder")!.handler({
        tag_id: "1",
        folder_id: null,
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("moved");
      expect(text.folder_id).toBeNull();
    });

    it("should throw when tag not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_move_tag_to_folder")!;
      await expect(tool.handler({ tag_id: "999", folder_id: "1" })).rejects.toThrow("Tag not found");
    });
  });
});
