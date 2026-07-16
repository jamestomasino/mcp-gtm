import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerVariableTools } from "../../src/tools/variables";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Variable tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerVariableTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerVariableTools(store);
  });

  describe("gtm_list_variables", () => {
    it("should return all user-defined variables", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_variables")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.total_count).toBe(2);
      expect(text.variables[0]).toHaveProperty("variable_id");
      expect(text.variables[0]).toHaveProperty("type_name");
    });
  });

  describe("gtm_get_variable", () => {
    it("should find variable by variable_id", async () => {
      const result = await tools.find((t) => t.name === "gtm_get_variable")!.handler({ variable_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.variableId).toBe("1");
      expect(text.type_name).toBeDefined();
    });

    it("should find variable by name", async () => {
      const variables = store.variables;
      const varName = variables[0].name;
      const result = await tools.find((t) => t.name === "gtm_get_variable")!.handler({ name: varName });
      const text = JSON.parse(result.content[0].text);
      expect(text.name).toBe(varName);
    });

    it("should throw when variable not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_variable")!;
      await expect(tool.handler({ variable_id: "999" })).rejects.toThrow("Variable not found");
    });
  });

  describe("gtm_create_variable", () => {
    it("should create a variable with auto-assigned ID", async () => {
      const result = await tools.find((t) => t.name === "gtm_create_variable")!.handler({
        name: "New Variable",
        type: "v",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("created");
      expect(text.variable.variableId).toBeDefined();
      expect(text.variable.name).toBe("New Variable");
    });

    it("should create a variable with parameters", async () => {
      const result = await tools.find((t) => t.name === "gtm_create_variable")!.handler({
        name: "Data Layer Var",
        type: "v",
        parameters: [
          { key: "dataLayerVersion", value: "2" },
          { key: "name", value: "test_var" },
        ],
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("created");
      expect(text.variable.parameter).toBeDefined();
    });
  });

  describe("gtm_update_variable", () => {
    it("should update a variable name", async () => {
      const result = await tools.find((t) => t.name === "gtm_update_variable")!.handler({
        variable_id: "1",
        name: "Updated Variable",
      });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("updated");
      expect(text.variable.name).toBe("Updated Variable");
    });

    it("should throw when variable not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_update_variable")!;
      await expect(tool.handler({ variable_id: "999", name: "nope" })).rejects.toThrow("Variable not found");
    });
  });

  describe("gtm_delete_variable", () => {
    it("should delete a variable", async () => {
      const result = await tools.find((t) => t.name === "gtm_delete_variable")!.handler({ variable_id: "1" });
      const text = JSON.parse(result.content[0].text);
      expect(text.status).toBe("deleted");
      expect(store.variables.find((v) => v.variableId === "1")).toBeUndefined();
    });

    it("should throw when variable not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_delete_variable")!;
      await expect(tool.handler({ variable_id: "999" })).rejects.toThrow("Variable not found");
    });
  });

  describe("gtm_list_builtin_variables", () => {
    it("should return built-in variables", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_builtin_variables")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text.total_count).toBe(3);
      expect(Array.isArray(text.builtInVariables)).toBe(true);
    });
  });
});
