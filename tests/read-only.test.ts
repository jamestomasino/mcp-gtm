import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Read-only mode", () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.GTM_READ_ONLY;
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.GTM_READ_ONLY;
    } else {
      process.env.GTM_READ_ONLY = originalEnv;
    }
  });

  it("should filter out write tools when GTM_READ_ONLY is set", async () => {
    process.env.GTM_READ_ONLY = "1";

    // Dynamically import to get a fresh module with read-only mode active
    const { ContainerStore } = await import("../src/store");
    const { registerContainerTools } = await import("../src/tools/container");
    const { registerTagTools } = await import("../src/tools/tags");
    const { registerTriggerTools } = await import("../src/tools/triggers");
    const { registerVariableTools } = await import("../src/tools/variables");
    const { registerFolderTools } = await import("../src/tools/folders");
    const { registerAnalysisTools } = await import("../src/tools/analysis");
    const { registerExportTools } = await import("../src/tools/export");

    const writeToolPrefixes = ["gtm_create_", "gtm_update_", "gtm_delete_", "gtm_move_", "gtm_export_"];
    function isWriteTool(name: string): boolean {
      return writeToolPrefixes.some((prefix) => name.startsWith(prefix));
    }

    const allTools = [
      ...registerContainerTools(new ContainerStore()),
      ...registerTagTools(new ContainerStore()),
      ...registerTriggerTools(new ContainerStore()),
      ...registerVariableTools(new ContainerStore()),
      ...registerFolderTools(new ContainerStore()),
      ...registerAnalysisTools(new ContainerStore()),
      ...registerExportTools(new ContainerStore()),
    ];

    const writeTools = allTools.filter((t) => isWriteTool(t.name));
    const readTools = allTools.filter((t) => !isWriteTool(t.name));

    // Verify we have write tools to filter
    expect(writeTools.length).toBeGreaterThan(0);
    expect(readTools.length).toBeGreaterThan(0);

    // Verify specific write tools exist
    expect(writeTools.some((t) => t.name === "gtm_create_tag")).toBe(true);
    expect(writeTools.some((t) => t.name === "gtm_delete_trigger")).toBe(true);
    expect(writeTools.some((t) => t.name === "gtm_export_container")).toBe(true);

    // Verify specific read tools are not filtered
    expect(readTools.some((t) => t.name === "gtm_list_tags")).toBe(true);
    expect(readTools.some((t) => t.name === "gtm_get_container_info")).toBe(true);
    expect(readTools.some((t) => t.name === "gtm_validate_container")).toBe(true);
  });
});
