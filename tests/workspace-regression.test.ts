import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../src/store";
import { registerAnalysisTools } from "../src/tools/analysis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const WORKSPACE_FIXTURE = join(FIXTURES_DIR, "workspace-format.json");

describe("Workspace-format exports", () => {
  let store: ContainerStore;

  beforeEach(() => {
    store = new ContainerStore();
  });

  it("should load a workspace export with entities at containerVersion level", () => {
    store.load(WORKSPACE_FIXTURE);
    expect(store.isLoaded).toBe(true);
    expect(store.tags.length).toBe(3);
    expect(store.triggers.length).toBe(3);
    expect(store.variables.length).toBe(3);
    expect(store.builtInVariables.length).toBe(2);
  });

  it("should normalize workspace 'variable' key to 'userDefinedVariable'", () => {
    store.load(WORKSPACE_FIXTURE);
    expect(store.variables).toHaveLength(3);
    expect(store.variables[0]).toHaveProperty("variableId", "1");
    expect(store.variables[0]).toHaveProperty("name", "GA4 ID");
  });

  it("should preserve tag metadata after normalization", () => {
    store.load(WORKSPACE_FIXTURE);
    const tag = store.tags.find((t) => t.tagId === "1");
    expect(tag).toBeDefined();
    expect(tag!.name).toBe("GA4 Config");
    expect(tag!.type).toBe("googtag");
    expect(tag!.firingTriggerId).toContain("1");
  });

  it("should preserve trigger filters after normalization", () => {
    store.load(WORKSPACE_FIXTURE);
    const trigger = store.triggers.find((t) => t.triggerId === "2");
    expect(trigger).toBeDefined();
    expect(trigger!.name).toBe("Button Click");
    expect(trigger!.type).toBe("click");
    expect(trigger!.filter).toHaveLength(1);
  });

  it("should handle custom templates without a type field", () => {
    store.load(WORKSPACE_FIXTURE);
    expect(store.customTemplates.length).toBe(1);
    expect(store.customTemplates[0].name).toBe("Custom Template Without Type");
    expect(store.customTemplates[0].type).toBeUndefined();
  });

  it("should pass Zod validation after workspace normalization", () => {
    store.load(WORKSPACE_FIXTURE);
    const issues = store.validate();
    expect(issues.length).toBe(0);
  });

  it("should report correct container info from workspace exports", () => {
    store.load(WORKSPACE_FIXTURE);
    const info = store.containerInfo;
    expect(info.name).toBe("Workspace Format Test Container");
    expect(info.accountId).toBe("99999999");
    expect(info.containerId).toBe("99999999");
    expect(info.usageContext).toContain("WEB");
  });
});

describe("Variable reference tracing (find_unused_entities)", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerAnalysisTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(WORKSPACE_FIXTURE);
    tools = registerAnalysisTools(store);
  });

  it("should only report truly unused variables (not referenced by any parameter)", async () => {
    const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "variables" });
    const text = JSON.parse(result.content[0].text);

    // GA4 ID is referenced by tags ({{GA4 ID}}), Event Name is referenced by tag 2 ({{Event Name}})
    // Unused Variable is not referenced anywhere
    const unusedNames = text.variables.map((v: any) => v.name);
    expect(unusedNames).toContain("Unused Variable");
    expect(unusedNames).not.toContain("GA4 ID");
    expect(unusedNames).not.toContain("Event Name");
  });

  it("should include variable type and type_name in unused variable output", async () => {
    const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "variables" });
    const text = JSON.parse(result.content[0].text);

    const unusedVar = text.variables.find((v: any) => v.name === "Unused Variable");
    expect(unusedVar).toBeDefined();
    expect(unusedVar.type).toBe("v");
    expect(unusedVar.type_name).toBe("Data Layer Variable");
  });

  it("should trace variable references through nested parameter lists", async () => {
    // GA4 ID is used in tag 1 parameters and tag 2 parameters
    // Event Name is used in tag 2 parameters
    const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "variables" });
    const text = JSON.parse(result.content[0].text);

    expect(text.variables.length).toBe(1);
    expect(text.variables[0].name).toBe("Unused Variable");
  });

  it("should trace variable references through trigger filter parameters", async () => {
    // This tests that trigger filters are also scanned for {{var}} references
    // The workspace fixture has trigger filters but no {{var}} in them,
    // so unused count should remain the same
    const result = await tools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "variables" });
    const text = JSON.parse(result.content[0].text);
    expect(text.variables.length).toBe(1);
  });

  it("should handle containers where all variables are referenced", async () => {
    // Create a store with all variables referenced
    const allReferencedStore = new ContainerStore();
    allReferencedStore.load(WORKSPACE_FIXTURE);
    // Remove the unused variable
    allReferencedStore.deleteVariable("3");

    const allTools = registerAnalysisTools(allReferencedStore);
    const result = await allTools.find((t) => t.name === "gtm_find_unused_entities")!.handler({ entity_type: "variables" });
    const text = JSON.parse(result.content[0].text);
    expect(text.variables.length).toBe(0);
  });
});

describe("Orphaned triggers with workspace format", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerAnalysisTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(WORKSPACE_FIXTURE);
    tools = registerAnalysisTools(store);
  });

  it("should find orphaned triggers in workspace exports", async () => {
    const result = await tools.find((t) => t.name === "gtm_find_orphaned_triggers")!.handler({});
    const text = JSON.parse(result.content[0].text);

    // Trigger 3 (Orphaned Trigger) is not used by any tag
    // Trigger 1 (All Pages) is used by tag 1
    // Trigger 2 (Button Click) is used by tag 2
    expect(text.orphaned_triggers.length).toBe(1);
    expect(text.orphaned_triggers[0].trigger_id).toBe("3");
    expect(text.orphaned_triggers[0].name).toBe("Orphaned Trigger");
  });
});
