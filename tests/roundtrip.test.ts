import { readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../src/store";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Round-trip: load → modify → export → reload", () => {
  it("should preserve all entities after round-trip", () => {
    const store1 = new ContainerStore();
    store1.load(SIMPLE_FIXTURE);

    // Modify: add a tag, update a trigger, delete a variable
    store1.createTag({
      name: "Round Trip Tag",
      type: "html",
      enabled: true,
      firingTriggerId: ["1"],
    });
    store1.updateTrigger("1", { name: "Modified All Pages" });
    store1.deleteVariable("2");

    // Export
    const outputPath = join(FIXTURES_DIR, "roundtrip.json");
    store1.exportTo(outputPath);

    // Reload
    const store2 = new ContainerStore();
    store2.load(outputPath);

    // Verify modifications persisted
    expect(store2.tags.length).toBe(4);
    expect(store2.tags.find((t) => t.name === "Round Trip Tag")).toBeDefined();
    expect(store2.triggers.find((t) => t.triggerId === "1")?.name).toBe("Modified All Pages");
    expect(store2.variables.length).toBe(1);
    expect(store2.variables.find((v) => v.variableId === "2")).toBeUndefined();

    unlinkSync(outputPath);
  });

  it("should preserve container metadata after round-trip", () => {
    const store1 = new ContainerStore();
    store1.load(SIMPLE_FIXTURE);

    const outputPath = join(FIXTURES_DIR, "roundtrip_meta.json");
    store1.exportTo(outputPath);

    const store2 = new ContainerStore();
    store2.load(outputPath);

    expect(store2.containerInfo.name).toBe("Test Web Container");
    expect(store2.containerInfo.accountId).toBe("12345678");
    expect(store2.containerInfo.defaultTimezone).toBe("America/New_York");

    unlinkSync(outputPath);
  });

  it("should handle multiple create → export → reload cycles", () => {
    const store1 = new ContainerStore();
    store1.load(SIMPLE_FIXTURE);

    // Cycle 1
    store1.createTag({ name: "Tag A", type: "gaawe", firingTriggerId: ["1"] });
    const path1 = join(FIXTURES_DIR, "cycle1.json");
    store1.exportTo(path1);

    // Cycle 2
    const store2 = new ContainerStore();
    store2.load(path1);
    store2.createTrigger({ name: "New Trigger", type: "custom" });
    const path2 = join(FIXTURES_DIR, "cycle2.json");
    store2.exportTo(path2);

    // Cycle 3
    const store3 = new ContainerStore();
    store3.load(path2);
    store3.createVariable({ name: "New Var", type: "v", parameter: [{ key: "name", value: "test" }] });

    expect(store3.tags.length).toBe(4); // 3 original + 1
    expect(store3.triggers.length).toBe(4); // 3 original + 1
    expect(store3.variables.length).toBe(3); // 2 original + 1

    unlinkSync(path1);
    unlinkSync(path2);
  });
});

describe("CRUD edge cases", () => {
  let store: ContainerStore;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
  });

  it("should auto-assign incrementing IDs", () => {
    const tag1 = store.createTag({ name: "Auto ID 1", type: "html" });
    const tag2 = store.createTag({ name: "Auto ID 2", type: "html" });
    expect(Number(tag2.tagId)).toBeGreaterThan(Number(tag1.tagId));
  });

  it("should allow explicit ID on create", () => {
    const tag = store.createTag({ tagId: "100", name: "Explicit ID", type: "html" });
    expect(tag.tagId).toBe("100");
  });

  it("should throw when updating non-existent entity", () => {
    expect(() => store.updateTag("999", { name: "nope" })).toThrow("Tag not found");
    expect(() => store.updateTrigger("999", { name: "nope" })).toThrow("Trigger not found");
    expect(() => store.updateVariable("999", { name: "nope" })).toThrow("Variable not found");
  });

  it("should handle entity with all optional fields", () => {
    const tag = store.createTag({
      name: "Full Tag",
      type: "gaawe",
      enabled: true,
      firingTriggerId: ["1", "2"],
      blockingTriggerId: ["3"],
      parentFolderId: "1",
      notes: "A fully specified tag",
      parameter: [
        { key: "configurationId", value: "G-TEST" },
        { key: "eventName", value: "test_event" },
      ],
    });
    expect(tag.name).toBe("Full Tag");
    expect(tag.firingTriggerId).toEqual(["1", "2"]);
    expect(tag.blockingTriggerId).toEqual(["3"]);
    expect(tag.parentFolderId).toBe("1");
  });

  it("should validate container after modifications", () => {
    store.createTag({ name: "Valid Tag", type: "html" });
    store.createTrigger({ name: "Valid Trigger", type: "custom" });
    store.createVariable({ name: "Valid Var", type: "v" });
    const issues = store.validate();
    expect(issues.length).toBe(0);
  });
});
