import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerTriggerTools } from "../../src/tools/triggers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Trigger tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerTriggerTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerTriggerTools(store);
  });

  describe("gtm_list_triggers", () => {
    it("should return all triggers with resolved names", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_triggers")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.total_count).toBe(3);
      expect(text.triggers[0]).toHaveProperty("trigger_id");
      expect(text.triggers[0]).toHaveProperty("type_name");
      expect(text.triggers[0]).toHaveProperty("folder_name");
    });
  });

  describe("gtm_get_trigger", () => {
    it("should find trigger by trigger_id", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_trigger")!.handler({ trigger_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.triggerId).toBe("1");
      expect(text.type_name).toBeDefined();
    });

    it("should find trigger by name", async () => {
      const triggers = store.triggers;
      const triggerName = triggers[0].name;
      const result = await tools.find((t) => t.name === "gtm_get_trigger")!.handler({ name: triggerName });
      const text = JSON.parse(result.content[0].text);
      expect(text.name).toBe(triggerName);
    });

    it("should throw when trigger not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_trigger")!;
      await expect(tool.handler({ trigger_id: "999" })).rejects.toThrow("Trigger not found");
    });
  });

  describe("gtm_create_trigger", () => {
    it("should create a trigger with auto-assigned ID", async () => {
      const result = await tools.find((t) => t.name === "gtm_create_trigger")!.handler({
        name: "New Trigger",
        type: "custom",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("created");
      expect(text.trigger.triggerId).toBeDefined();
      expect(text.trigger.name).toBe("New Trigger");
    });
  });

  describe("gtm_update_trigger", () => {
    it("should update a trigger name", async () => {
      const result = await tools.find((t) => t.name === "gtm_update_trigger")!.handler({
        trigger_id: "1",
        name: "Updated Trigger",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("updated");
      expect(text.trigger.name).toBe("Updated Trigger");
    });

    it("should throw when trigger not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_update_trigger")!;
      await expect(tool.handler({ trigger_id: "999", name: "nope" })).rejects.toThrow("Trigger not found");
    });
  });

  describe("gtm_delete_trigger", () => {
    it("should delete a trigger", async () => {
      const result = await tools.find((t) => t.name === "gtm_delete_trigger")!.handler({ trigger_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("deleted");
      expect(store.triggers.find((t) => t.triggerId === "1")).toBeUndefined();
    });

    it("should throw when trigger not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_delete_trigger")!;
      await expect(tool.handler({ trigger_id: "999" })).rejects.toThrow("Trigger not found");
    });
  });
});
