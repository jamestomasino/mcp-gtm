import { readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerContainerTools } from "../../src/tools/container";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Container tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerContainerTools>;

  beforeEach(() => {
    store = new ContainerStore();
    tools = registerContainerTools(store);
  });

  describe("gtm_load_container", () => {
    it("should load a container and return info", async () => {
      const result = await tools.find((t) => t.name === "gtm_load_container")!.handler({
        file_path: SIMPLE_FIXTURE,
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("loaded");
      expect(text.container.name).toBe("Test Web Container");
      expect(text.counts.tags).toBe(3);
    });

    it("should fail with invalid file path", async () => {
      const tool = tools.find((t) => t.name === "gtm_load_container")!;
      await expect(tool.handler({ file_path: "/nonexistent.json" })).rejects.toThrow();
    });
  });

  describe("gtm_get_container_info", () => {
    beforeEach(() => {
      store.load(SIMPLE_FIXTURE);
    });

    it("should return container metadata", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_container_info")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.name).toBe("Test Web Container");
      expect(text.accountId).toBe("12345678");
      expect(text.containerId).toBe("87654321");
      expect(text.defaultTimezone).toBe("America/New_York");
      expect(text.usageContextNames).toBeDefined();
    });

    it("should throw when no container loaded", async () => {
      const freshStore = new ContainerStore();
      const freshTools = registerContainerTools(freshStore);
      const tool = freshTools.find((t) => t.name === "gtm_get_container_info")!;
      await expect(tool.handler({})).rejects.toThrow("No container loaded");
    });
  });

  describe("gtm_get_container_state", () => {
    beforeEach(() => {
      store.load(SIMPLE_FIXTURE);
    });

    it("should return entity counts", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_container_state")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.tags).toBe(3);
      expect(text.triggers).toBe(3);
      expect(text.variables).toBe(2);
      expect(text.folders).toBe(2);
      expect(text.builtInVariables).toBe(3);
      expect(text.source_path).toBe(SIMPLE_FIXTURE);
    });
  });
});
