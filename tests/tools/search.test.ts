import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { ContainerStore } from "../../src/store";
import { registerSearchTools } from "../../src/tools/search";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const SIMPLE_FIXTURE = join(FIXTURES_DIR, "simple.json");

describe("Search tools", () => {
  let store: ContainerStore;
  let tools: ReturnType<typeof registerSearchTools>;

  beforeEach(() => {
    store = new ContainerStore();
    store.load(SIMPLE_FIXTURE);
    tools = registerSearchTools(store);
  });

  describe("gtm_search", () => {
    it("should search across all entities by default", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "GA4"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.total_matches).toBeGreaterThan(0);
      expect(text.results).toBeInstanceOf(Array);
    });

    it("should filter by entity type", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "GA4",
          entity_type: "tags"
        });
      const text = JSON.parse(result.content[0].text);
      for (const r of text.results) {
        expect(r.entity_type).toBe("tag");
      }
    });

    it("should be case-insensitive by default", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "ga4"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.total_matches).toBeGreaterThan(0);
    });

    it("should support case-sensitive search", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "GA4",
          case_sensitive: true
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.total_matches).toBeGreaterThan(0);
    });

    it("should return match_field indicating which field matched", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "Test"
        });
      const text = JSON.parse(result.content[0].text);
      for (const r of text.results) {
        expect(r.match_field).toBeOneOf(["name", "notes"]);
      }
    });

    it("should return empty results for non-matching query", async () => {
      const result = await tools
        .find((t) => t.name === "gtm_search")!
        .handler({
          query: "xyznonexistent"
        });
      const text = JSON.parse(result.content[0].text);
      expect(text.total_matches).toBe(0);
      expect(text.results).toHaveLength(0);
    });
  });
});
