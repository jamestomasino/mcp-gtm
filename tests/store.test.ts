import { readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../src/store";
import { GtmExportSchema, TagSchema, TriggerSchema, VariableSchema } from "../src/schemas/index";
import type { Tag, Trigger, Variable } from "../src/schemas/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");
const COMPLEX_FIXTURE = join(FIXTURES_DIR, "complex.json");

describe("GTM Schemas", () => {
  it("should validate a simple container export", () => {
    const data = JSON.parse(readFileSync(SIMPLE_FIXTURE, "utf-8"));
    const result = GtmExportSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should validate a complex container export", () => {
    const data = JSON.parse(readFileSync(COMPLEX_FIXTURE, "utf-8"));
    const result = GtmExportSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should reject invalid export (missing container)", () => {
    const result = GtmExportSchema.safeParse({ exportTime: "2026-01-01" });
    expect(result.success).toBe(false);
  });

  it("should validate a GA4 tag", () => {
    const tag: Tag = {
      tagId: "1",
      name: "GA4 Page View",
      type: "gaawe",
      enabled: true,
      parameter: [
        { key: "configurationId", value: "G-TEST1234" },
        { key: "eventName", value: "page_view" },
      ],
      firingTriggerId: ["1"],
    };
    const result = TagSchema.safeParse(tag);
    expect(result.success).toBe(true);
  });

  it("should reject a tag without a name", () => {
    const result = TagSchema.safeParse({ tagId: "1", type: "gaawe" });
    expect(result.success).toBe(false);
  });

  it("should validate a pageview trigger", () => {
    const trigger: Trigger = {
      triggerId: "1",
      name: "All Pages",
      type: "pageview",
      filter: [],
    };
    const result = TriggerSchema.safeParse(trigger);
    expect(result.success).toBe(true);
  });

  it("should validate a data layer variable", () => {
    const variable: Variable = {
      variableId: "1",
      name: "Event Name",
      type: "v",
      parameter: [
        { key: "dataLayerVersion", value: "2" },
        { key: "name", value: "event" },
      ],
    };
    const result = VariableSchema.safeParse(variable);
    expect(result.success).toBe(true);
  });
});

describe("ContainerStore", () => {
  let store: ContainerStore;

  beforeEach(() => {
    store = new ContainerStore();
  });

  it("should not be loaded initially", () => {
    expect(store.isLoaded).toBe(false);
  });

  it("should load a container from a JSON file", () => {
    store.load(SIMPLE_FIXTURE);
    expect(store.isLoaded).toBe(true);
    expect(store.sourcePath).toBe(SIMPLE_FIXTURE);
  });

  it("should throw when accessing data before loading", () => {
    expect(() => store.data).toThrow("No container loaded");
  });

  it("should load container with correct entity counts", () => {
    store.load(SIMPLE_FIXTURE);
    const state = store.state;
    expect(state.tags).toBe(3);
    expect(state.triggers).toBe(3);
    expect(state.variables).toBe(2);
    expect(state.folders).toBe(2);
    expect(state.builtInVariables).toBe(3);
  });

  it("should provide container info", () => {
    store.load(SIMPLE_FIXTURE);
    const info = store.containerInfo;
    expect(info.name).toBe("Test Web Container");
    expect(info.accountId).toBe("12345678");
    expect(info.containerId).toBe("87654321");
    expect(info.defaultTimezone).toBe("America/New_York");
  });

  it("should create a new tag with auto-assigned ID", () => {
    store.load(SIMPLE_FIXTURE);
    const newTag = store.createTag({
      name: "New GA4 Tag",
      type: "gaawe",
      enabled: true,
      firingTriggerId: ["1"],
    });
    expect(newTag.tagId).toBeDefined();
    expect(newTag.name).toBe("New GA4 Tag");
    expect(store.tags.length).toBe(4);
  });

  it("should create a new trigger with auto-assigned ID", () => {
    store.load(SIMPLE_FIXTURE);
    const newTrigger = store.createTrigger({
      name: "Custom Event",
      type: "custom",
    });
    expect(newTrigger.triggerId).toBeDefined();
    expect(newTrigger.name).toBe("Custom Event");
    expect(store.triggers.length).toBe(4);
  });

  it("should create a new variable with auto-assigned ID", () => {
    store.load(SIMPLE_FIXTURE);
    const newVar = store.createVariable({
      name: "Custom Variable",
      type: "v",
      parameter: [{ key: "name", value: "custom_var" }],
    });
    expect(newVar.variableId).toBeDefined();
    expect(newVar.name).toBe("Custom Variable");
    expect(store.variables.length).toBe(3);
  });

  it("should update an existing tag", () => {
    store.load(SIMPLE_FIXTURE);
    const updated = store.updateTag("1", { name: "Renamed GA4 Tag", enabled: false });
    expect(updated.name).toBe("Renamed GA4 Tag");
    expect(updated.enabled).toBe(false);
    expect(store.tags.find((t) => t.tagId === "1")?.name).toBe("Renamed GA4 Tag");
  });

  it("should update an existing trigger", () => {
    store.load(SIMPLE_FIXTURE);
    const updated = store.updateTrigger("1", { name: "All Pages (Renamed)" });
    expect(updated.name).toBe("All Pages (Renamed)");
  });

  it("should update an existing variable", () => {
    store.load(SIMPLE_FIXTURE);
    const updated = store.updateVariable("1", { name: "Renamed URL Variable" });
    expect(updated.name).toBe("Renamed URL Variable");
  });

  it("should delete a tag", () => {
    store.load(SIMPLE_FIXTURE);
    const deleted = store.deleteTag("3");
    expect(deleted).toBe(true);
    expect(store.tags.length).toBe(2);
    expect(store.tags.find((t) => t.tagId === "3")).toBeUndefined();
  });

  it("should delete a trigger", () => {
    store.load(SIMPLE_FIXTURE);
    const deleted = store.deleteTrigger("3");
    expect(deleted).toBe(true);
    expect(store.triggers.length).toBe(2);
  });

  it("should delete a variable", () => {
    store.load(SIMPLE_FIXTURE);
    const deleted = store.deleteVariable("1");
    expect(deleted).toBe(true);
    expect(store.variables.length).toBe(1);
  });

  it("should return false when deleting non-existent entity", () => {
    store.load(SIMPLE_FIXTURE);
    expect(store.deleteTag("999")).toBe(false);
    expect(store.deleteTrigger("999")).toBe(false);
    expect(store.deleteVariable("999")).toBe(false);
  });

  it("should export container to a file", () => {
    store.load(SIMPLE_FIXTURE);
    const outputPath = join(FIXTURES_DIR, "exported_test.json");
    store.exportTo(outputPath);

    const exported = JSON.parse(readFileSync(outputPath, "utf-8"));
    expect(exported.containerVersion.container.name).toBe("Test Web Container");
    expect(exported.containerVersion.container.tag.length).toBe(3);

    // Cleanup
    unlinkSync(outputPath);
  });

  it("should support round-trip: load → modify → export → reload", () => {
    const store1 = new ContainerStore();
    store1.load(SIMPLE_FIXTURE);

    // Modify
    store1.createTag({
      name: "Round Trip Tag",
      type: "html",
      enabled: true,
      firingTriggerId: ["1"],
    });

    // Export
    const outputPath = join(FIXTURES_DIR, "roundtrip_test.json");
    store1.exportTo(outputPath);

    // Reload
    const store2 = new ContainerStore();
    store2.load(outputPath);
    expect(store2.tags.length).toBe(4);
    expect(store2.tags.find((t) => t.name === "Round Trip Tag")).toBeDefined();

    // Cleanup
    unlinkSync(outputPath);
  });

  it("should validate a loaded container", () => {
    store.load(SIMPLE_FIXTURE);
    const issues = store.validate();
    expect(issues.length).toBe(0);
  });

  it("should reject invalid tag creation (missing required fields)", () => {
    store.load(SIMPLE_FIXTURE);
    expect(() => {
      store.createTag({} as any);
    }).toThrow();
  });
});
