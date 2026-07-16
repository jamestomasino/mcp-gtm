import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerAnalysisTools } from "../../src/tools/analysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Analysis tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerAnalysisTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerAnalysisTools(store);
  });

  describe("gtm_get_tag_dependencies", () => {
    it("should return tag dependencies by tag_id", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_tag_dependencies")!.handler({ tag_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.tag_id).toBe("1");
      expect(text).toHaveProperty("firing_triggers");
      expect(text).toHaveProperty("blocking_triggers");
    });

    it("should return tag dependencies by name", async () => {
      const tagName = store.tags[0].name;
      const result = await tools.find((t) => t.name === "gtm_get_tag_dependencies")!.handler({ name: tagName });
      const text = JSON.parse(result.content[0].text);
      expect(text.tag_name).toBe(tagName);
    });

    it("should throw when tag not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_tag_dependencies")!;
      await expect(tool.handler({ tag_id: "999" })).rejects.toThrow("Tag not found");
    });
  });

  describe("gtm_find_unused_entities", () => {
    it("should find unused entities for all types", async () => {
      const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "all" });
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("tags");
      expect(text).toHaveProperty("triggers");
      expect(text).toHaveProperty("variables");
    });

    it("should find unused triggers only", async () => {
      const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "triggers" });
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("triggers");
      expect(text.tags).toBeUndefined();
      expect(text.variables).toBeUndefined();
    });

    it("should find disabled tags", async () => {
      const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "tags" });
      const text = JSON.parse(result.content[0].text);
      expect(Array.isArray(text.tags)).toBe(true);
    });
  });

  describe("gtm_find_orphaned_triggers", () => {
    it("should find orphaned triggers", async () => {
      const result = await tools.find((t) => t.name === "gtm_find_orphaned_triggers")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("orphaned_triggers");
      expect(text).toHaveProperty("total_count");
      expect(Array.isArray(text.orphaned_triggers)).toBe(true);
    });
  });

  describe("gtm_validate_container", () => {
    it("should validate a clean container", async () => {
      const result = await tools.find((t) => t.name === "gtm_validate_container")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.valid).toBe(true);
      expect(text.issue_count).toBe(0);
      expect(text.issues.length).toBe(0);
    });
  });
});
