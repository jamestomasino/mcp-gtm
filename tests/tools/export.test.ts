import { readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerExportTools } from "../../src/tools/export";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");
const COMPLEX_FIXTURE = join(FIXTURES_DIR, "complex.json");

describe("Export tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerExportTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerExportTools(store);
  });

  describe("gtm_export_container", () => {
    const exportPath = join(FIXTURES_DIR, "tool_test_export.json");

    afterEach(() => {
      try {
        unlinkSync(exportPath);
      } catch {
        // ignore cleanup errors
      }
    });

    it("should export container to file", async () => {
      const result = await tools.find((t) => t.name === "gtm_export_container")!.handler({ file_path: exportPath });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("exported");
      expect(text.file_path).toBe(exportPath);
      expect(text.counts.tags).toBe(3);

      // Verify file was written
      const exported = JSON.parse(readFileSync(exportPath, "utf-8"));
      expect(exported.containerVersion.container.name).toBe("Test Web Container");
    });

    it("should export modified container", async () => {
      store.createTag({ name: "Exported Tag", type: "html" });

      const result = await tools.find((t) => t.name === "gtm_export_container")!.handler({ file_path: exportPath });
      const text = JSON.parse(result.content[0].text);
      expect(text.counts.tags).toBe(4);

      const exported = JSON.parse(readFileSync(exportPath, "utf-8"));
      expect(exported.containerVersion.container.tag.length).toBe(4);
    });
  });

  describe("gtm_diff_containers", () => {
    it("should diff two container files", async () => {
      const result = await tools.find((t) => t.name === "gtm_diff_containers")!.handler({
        file_a: SIMPLE_FIXTURE,
        file_b: COMPLEX_FIXTURE,
      });
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("tags");
      expect(text).toHaveProperty("triggers");
      expect(text).toHaveProperty("variables");
      expect(text.tags).toHaveProperty("added");
      expect(text.tags).toHaveProperty("removed");
      expect(text.tags).toHaveProperty("count_a");
      expect(text.tags).toHaveProperty("count_b");
    });

    it("should show no differences for identical files", async () => {
      const result = await tools.find((t) => t.name === "gtm_diff_containers")!.handler({
        file_a: SIMPLE_FIXTURE,
        file_b: SIMPLE_FIXTURE,
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.tags.added.length).toBe(0);
      expect(text.tags.removed.length).toBe(0);
      expect(text.triggers.added.length).toBe(0);
      expect(text.triggers.removed.length).toBe(0);
    });

    it("should fail with invalid file path", async () => {
      const tool = tools.find((t) => t.name === "gtm_diff_containers")!;
      await expect(tool.handler({
        file_a: "/nonexistent.json",
        file_b: SIMPLE_FIXTURE,
      })).rejects.toThrow();
    });
  });
});
