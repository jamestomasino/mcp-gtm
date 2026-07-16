import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerServerSideTools } from "../../src/tools/serverSide";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Server-side GTM tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerServerSideTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerServerSideTools(store);
  });

  describe("gtm_list_zones", () => {
    it("should return zones (empty for web container)", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_zones")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("zones");
      expect(text).toHaveProperty("total_count");
      expect(Array.isArray(text.zones)).toBe(true);
    });
  });

  describe("gtm_list_clients", () => {
    it("should return clients (empty for web container)", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_clients")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("clients");
      expect(text).toHaveProperty("total_count");
      expect(Array.isArray(text.clients)).toBe(true);
    });
  });

  describe("gtm_list_transformations", () => {
    it("should return transformations (empty for web container)", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_transformations")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("transformations");
      expect(text).toHaveProperty("total_count");
      expect(Array.isArray(text.transformations)).toBe(true);
    });
  });

  describe("gtm_get_zone", () => {
    it("should throw when zone not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_zone")!;
      await expect(tool.handler({ zone_id: "999" })).rejects.toThrow("Zone not found");
    });
  });

  describe("gtm_get_client", () => {
    it("should throw when client not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_client")!;
      await expect(tool.handler({ client_id: "999" })).rejects.toThrow("Client not found");
    });
  });

  describe("gtm_get_transformation", () => {
    it("should throw when transformation not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_transformation")!;
      await expect(tool.handler({ transformation_id: "999" })).rejects.toThrow("Transformation not found");
    });
  });

  describe("gtm_list_custom_templates", () => {
    it("should return custom templates (empty for web container)", async () => {
      const result = await tools.find((t) => t.name === "gtm_list_custom_templates")!.handler({});
      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveProperty("custom_templates");
      expect(text).toHaveProperty("total_count");
      expect(Array.isArray(text.custom_templates)).toBe(true);
    });
  });

  describe("gtm_get_custom_template", () => {
    it("should throw when template not found", async () => {
      const tool = tools.find((t) => t.name === "gtm_get_custom_template")!;
      await expect(tool.handler({ template_id: "999" })).rejects.toThrow("Custom template not found");
    });
  });
});
