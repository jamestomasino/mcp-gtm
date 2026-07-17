import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerTagTools } from "../../src/tools/tags";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Tag tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerTagTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerTagTools(store);
  });

  describe("gtm_list_tags", () => {
    it("should return all tags with resolved names", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_list_tags")!
        .handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.total_count).toBe(3);
      expect(text.tags[0]).toHaveProperty("tag_id");
      expect(text.tags[0]).toHaveProperty("type_name");
      expect(text.tags[0]).toHaveProperty("folder_name");
      expect(text.tags[0]).toHaveProperty("enabled");
    });
  });

  describe("gtm_get_tag", () => {
    it("should find tag by tag_id", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_get_tag")!
        .handler({ tag_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.tagId).toBe("1");
      expect(text.type_name).toBeDefined();
      expect(text.firing_trigger_names).toBeDefined();
    });

    it("should find tag by name", async () => {
      const tags = store.tags;
      const tagName = tags[0].name;
      const result = await tools
        .find((t) => t.name === "gtm_get_tag")!
        .handler({ name: tagName });
      const text = JSON.parse(result.content[0].text);
      expect(text.name).toBe(tagName);
    });

    it("should throw when tag not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_tag")!;
      await expect(tool.handler({ tag_id: "999" })).rejects.toThrow(
        "Tag not found"
      );
    });
  });

  describe("gtm_create_tag", () => {
    it("should create a tag with auto-assigned ID", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_create_tag")!
        .handler({
          name: "New Tag",
          type: "html"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("created");
      expect(text.tag.tagId).toBeDefined();
      expect(text.tag.name).toBe("New Tag");
    });
  });

  describe("gtm_update_tag", () => {
    it("should update a tag name", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_update_tag")!
        .handler({
          tag_id: "1",
          name: "Updated Tag"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("updated");
      expect(text.tag.name).toBe("Updated Tag");
    });

    it("should throw when tag not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_update_tag")!;
      await expect(
        tool.handler({ tag_id: "999", name: "nope" })
      ).rejects.toThrow("Tag not found");
    });
  });

  describe("gtm_delete_tag", () => {
    it("should delete a tag", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_delete_tag")!
        .handler({ tag_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("deleted");
      expect(store.tags.find((t) => t.tagId === "1")).toBeUndefined();
    });

    it("should throw when tag not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_delete_tag")!;
      await expect(tool.handler({ tag_id: "999" })).rejects.toThrow(
        "Tag not found"
      );
    });
  });

  describe("gtm_find_tags_by_type", () => {
    it("should find tags by type", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_find_tags_by_type")!
        .handler({
          type: "gaawe"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.type).toBe("gaawe");
      expect(text.tags).toBeInstanceOf(Array);
    });
  });
});
