import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerUndoTools } from "../../src/tools/undo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Undo/Redo tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerUndoTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerUndoTools(store);
  });

  describe("gtm_undo", () => {
    it("should undo a tag creation", async () => {
      store.createTag({
        name: "Undo Test Tag",
        type: "html",
        enabled: true,
      });
      expect(store.tags.length).toBe(4);

      const result = await tools
        .find((t) => t.name === "gtm_undo")!
        .handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.undone).toBe(true);
      expect(text.current_state.tags).toBe(3);
      expect(store.tags.length).toBe(3);
    });

    it("should undo a tag update", async () => {
      store.updateTag("1", { name: "Modified Name" });
      expect(store.tags.find((t) => t.tagId === "1")?.name).toBe("Modified Name");

      await tools.find((t) => t.name === "gtm_undo")!.handler({});
      expect(store.tags.find((t) => t.tagId === "1")?.name).toBe("GA4 Page View");
    });

    it("should undo a tag deletion", async () => {
      store.deleteTag("3");
      expect(store.tags.length).toBe(2);

      await tools.find((t) => t.name === "gtm_undo")!.handler({});
      expect(store.tags.length).toBe(3);
    });

    it("should report undo/redo step counts", async () => {
      store.createTag({ name: "A", type: "html" });
      store.createTag({ name: "B", type: "html" });

      const result = await tools
        .find((t) => t.name === "gtm_undo")!
        .handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.undo_steps_remaining).toBe(1);
      expect(text.redo_steps_available).toBe(1);
    });

    it("should throw when nothing to undo", async () => {
      await expect(
        tools.find((t) => t.name === "gtm_undo")!.handler({})
      ).rejects.toThrow("Nothing to undo");
    });

    it("should throw when container not loaded", async () => {
      const emptyStore = new ContainerStore();
      const emptyTools = registerUndoTools(emptyStore);
      await expect(
        emptyTools.find((t) => t.name === "gtm_undo")!.handler({})
      ).rejects.toThrow("No container loaded");
    });
  });

  describe("gtm_redo", () => {
    it("should redo an undone tag creation", async () => {
      store.createTag({
        name: "Redo Test Tag",
        type: "html",
      });
      expect(store.tags.length).toBe(4);

      // Undo
      await tools.find((t) => t.name === "gtm_undo")!.handler({});
      expect(store.tags.length).toBe(3);

      // Redo
      const result = await tools
        .find((t) => t.name === "gtm_redo")!
        .handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.redone).toBe(true);
      expect(store.tags.length).toBe(4);
    });

    it("should throw when nothing to redo", async () => {
      await expect(
        tools.find((t) => t.name === "gtm_redo")!.handler({})
      ).rejects.toThrow("Nothing to redo");
    });

    it("should clear redo stack on new mutation", async () => {
      store.createTag({ name: "A", type: "html" });
      await tools.find((t) => t.name === "gtm_undo")!.handler({});

      // New mutation clears redo stack
      store.createTag({ name: "B", type: "html" });
      await expect(
        tools.find((t) => t.name === "gtm_redo")!.handler({})
      ).rejects.toThrow("Nothing to redo");
    });

    it("should throw when container not loaded", async () => {
      const emptyStore = new ContainerStore();
      const emptyTools = registerUndoTools(emptyStore);
      await expect(
        emptyTools.find((t) => t.name === "gtm_redo")!.handler({})
      ).rejects.toThrow("No container loaded");
    });
  });
});
