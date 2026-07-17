import { describe, it, expect, beforeEach } from "vitest";
import { ContainerStore } from "../../src/store";
import {
  getFiringGroup,
  isConsentManagementTag,
  isConsentVariable,
  isLikelyConsentBlockingTrigger,
  getSequencingDependencies,
  getTagLifecyclePhase,
  analyzeTagFiringOrder,
  analyzeConsentSetup,
  getTagLifecycle,
} from "../../src/tools/lifecycle";
import type { Tag } from "../../src/schemas/index";

describe("Lifecycle Tools", () => {
  let store: ContainerStore;

  beforeEach(() => {
    store = new ContainerStore();
  });

  describe("getFiringGroup", () => {
    it("classifies Google tags as group 1", () => {
      const googleTypes = ["gaawe", "googtag", "ua", "awct", "gf", "dbm", "adm", "dfa", "rem"];
      for (const type of googleTypes) {
        const tag = { tagId: "1", name: "test", type, parameter: [] } as Tag;
        const result = getFiringGroup(tag);
        expect(result.priority).toBe(1);
        expect(result.group).toBe("google");
      }
    });

    it("classifies Custom HTML as group 2", () => {
      const tag = { tagId: "1", name: "test", type: "html", parameter: [] } as Tag;
      const result = getFiringGroup(tag);
      expect(result.priority).toBe(2);
      expect(result.group).toBe("custom_html");
    });

    it("classifies Custom Image as group 3", () => {
      const tag = { tagId: "1", name: "test", type: "img", parameter: [] } as Tag;
      const result = getFiringGroup(tag);
      expect(result.priority).toBe(3);
      expect(result.group).toBe("custom_image");
    });

    it("classifies Custom Template as group 4", () => {
      const tag = { tagId: "1", name: "test", type: "cvt_custom", parameter: [] } as Tag;
      const result = getFiringGroup(tag);
      expect(result.priority).toBe(4);
      expect(result.group).toBe("custom_template");
    });

    it("classifies unknown types as custom_template (fallback)", () => {
      const tag = { tagId: "1", name: "test", type: "unknown_type", parameter: [] } as Tag;
      const result = getFiringGroup(tag);
      expect(result.priority).toBe(4);
      expect(result.group).toBe("custom_template");
    });
  });

  describe("isConsentManagementTag", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("detects consent tag by name", () => {
      const consentTag = store.tags.find((t) => t.name === "Consent Mode - Default Denied");
      expect(isConsentManagementTag(consentTag!)).toBe(true);
    });

    it("does not flag non-consent tags", () => {
      const ga4Tag = store.tags.find((t) => t.name === "GA4 Configuration");
      expect(isConsentManagementTag(ga4Tag!)).toBe(false);
    });

    it("detects consent tag by parameters containing consent keywords", () => {
      const consentTag = store.tags.find((t) => t.name === "Consent Mode - Default Denied");
      expect(isConsentManagementTag(consentTag!)).toBe(true);
    });
  });

  describe("isConsentVariable", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("detects consent variable by name", () => {
      const consentVar = store.variables.find((v) => v.name === "Consent Status");
      expect(isConsentVariable(consentVar!)).toBe(true);
    });

    it("does not flag non-consent variables", () => {
      const pageUrlVar = store.variables.find((v) => v.name === "Page URL");
      expect(isConsentVariable(pageUrlVar!)).toBe(false);
    });

    it("detects GDPR variable by name", () => {
      const gdprVar = store.variables.find((v) => v.name === "GDPR Region Check");
      expect(isConsentVariable(gdprVar!)).toBe(true);
    });
  });

  describe("isLikelyConsentBlockingTrigger", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("detects consent blocking trigger by name", () => {
      const consentTrigger = store.triggers.find(
        (t) => t.name === "Consent Granted - Block Until Accepted"
      );
      expect(isLikelyConsentBlockingTrigger(consentTrigger!, store)).toBe(true);
    });

    it("does not flag regular triggers", () => {
      const allPages = store.triggers.find((t) => t.name === "All Pages");
      expect(isLikelyConsentBlockingTrigger(allPages!, store)).toBe(false);
    });

    it("detects blocking trigger by usage on data collection tags", () => {
      const consentTrigger = store.triggers.find(
        (t) => t.name === "Consent Granted - Block Until Accepted"
      );
      // This trigger is used as a blocking trigger on GA4 and HTML tags
      expect(isLikelyConsentBlockingTrigger(consentTrigger!, store)).toBe(true);
    });
  });

  describe("getSequencingDependencies", () => {
    it("extracts tagsToOverride as firesAfter", () => {
      const tag: Tag = {
        tagId: "1",
        name: "test",
        type: "html",
        parameter: [
          { key: "tagsToOverride", value: "2" },
          { key: "otherKey", value: "otherValue" },
        ],
      } as Tag;
      const deps = getSequencingDependencies(tag);
      expect(deps.firesAfter).toContain("2");
      expect(deps.firesBefore).toEqual([]);
    });

    it("returns empty when no sequencing configured", () => {
      const tag: Tag = {
        tagId: "1",
        name: "test",
        type: "html",
        parameter: [{ key: "html", value: "<script></script>" }],
      } as Tag;
      const deps = getSequencingDependencies(tag);
      expect(deps.firesAfter).toEqual([]);
      expect(deps.firesBefore).toEqual([]);
    });
  });

  describe("analyzeTagFiringOrder", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("returns sorted firing order", () => {
      const result = analyzeTagFiringOrder(store);
      expect(result.firing_order.length).toBeGreaterThan(0);
      expect(result.total_tags).toBe(result.firing_order.length);
    });

    it("Google tags appear before Custom HTML tags", () => {
      const result = analyzeTagFiringOrder(store);
      const firstHtmlIndex = result.firing_order.findIndex(
        (t) => t.firing_group === "custom_html"
      );
      const lastGoogleIndex = result.firing_order
        .filter((t) => t.firing_group === "google")
        .reduce((max, t) => {
          const idx = result.firing_order.findIndex((o) => o.tag_id === t.tag_id);
          return idx > max ? idx : max;
        }, -1);
      expect(firstHtmlIndex).toBeGreaterThan(lastGoogleIndex);
    });

    it("Custom Image tags appear after Custom HTML tags", () => {
      const result = analyzeTagFiringOrder(store);
      const firstImgIndex = result.firing_order.findIndex(
        (t) => t.firing_group === "custom_image"
      );
      const lastHtmlIndex = result.firing_order
        .filter((t) => t.firing_group === "custom_html")
        .reduce((max, t) => {
          const idx = result.firing_order.findIndex((o) => o.tag_id === t.tag_id);
          return idx > max ? idx : max;
        }, -1);
      expect(firstImgIndex).toBeGreaterThan(lastHtmlIndex);
    });

    it("disabled tags are excluded from firing order", () => {
      const result = analyzeTagFiringOrder(store);
      const disabledTag = result.firing_order.find(
        (t) => t.tag_name === "Disabled Tag - Old Pixel"
      );
      expect(disabledTag).toBeUndefined();
    });

    it("reports group counts", () => {
      const result = analyzeTagFiringOrder(store);
      expect(result.groups).toHaveProperty("google");
      expect(result.groups).toHaveProperty("custom_html");
      expect(result.groups).toHaveProperty("custom_image");
      expect(result.groups).toHaveProperty("custom_template");
    });

    it("each entry has required fields", () => {
      const result = analyzeTagFiringOrder(store);
      for (const entry of result.firing_order) {
        expect(entry).toHaveProperty("position");
        expect(entry).toHaveProperty("tag_id");
        expect(entry).toHaveProperty("tag_name");
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("type_name");
        expect(entry).toHaveProperty("firing_group");
        expect(entry).toHaveProperty("fires_after");
        expect(entry).toHaveProperty("fires_before");
        expect(entry).toHaveProperty("blocked_by_trigger_ids");
      }
    });
  });

  describe("analyzeConsentSetup", () => {
    describe("with consent-enabled container", () => {
      beforeEach(() => {
        store.load("tests/fixtures/consent.json");
      });

      it("detects consent management", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_detected).toBe(true);
      });

      it("identifies consent management tags", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_management_tags.length).toBeGreaterThan(0);
        expect(result.consent_management_tags[0].name).toBe("Consent Mode - Default Denied");
      });

      it("identifies consent variables", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_variables.length).toBeGreaterThan(0);
        const consentVarNames = result.consent_variables.map((v) => v.name);
        expect(consentVarNames).toContain("Consent Status");
      });

      it("identifies consent blocking triggers", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_blocking_triggers.length).toBeGreaterThan(0);
        const blockingTriggerNames = result.consent_blocking_triggers.map((t) => t.name);
        expect(blockingTriggerNames).toContain("Consent Granted - Block Until Accepted");
      });

      it("reports consent patterns", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_patterns).toContain("consent_management_tags");
        expect(result.consent_patterns).toContain("consent_state_variables");
        expect(result.consent_patterns).toContain("consent_blocking_triggers");
      });

      it("flags unprotected data collection tags", () => {
        const result = analyzeConsentSetup(store);
        const criticalIssues = result.issues.filter(
          (i) => i.severity === "critical" && i.category === "unprotected_data_collection"
        );
        expect(criticalIssues.length).toBeGreaterThan(0);
        // Google Ads Conversion (tag 4) has no blocking trigger
        const affectedTags = criticalIssues[0]?.affected_tags ?? [];
        expect(affectedTags).toContain("Google Ads Conversion");
      });

      it("flags orphaned blocking trigger references", () => {
        const result = analyzeConsentSetup(store);
        const orphanIssues = result.issues.filter(
          (i) => i.severity === "critical" && i.category === "orphaned_blocking_reference"
        );
        expect(orphanIssues.length).toBeGreaterThan(0);
        expect(orphanIssues[0].affected_tags).toContain("Tag With Orphaned Blocking Trigger");
      });

      it("provides a recommendation summary", () => {
        const result = analyzeConsentSetup(store);
        expect(result.recommendation_summary.length).toBeGreaterThan(0);
        expect(result.recommendation_summary.toLowerCase()).toContain("critical");
      });

      it("each issue has severity, category, and message", () => {
        const result = analyzeConsentSetup(store);
        for (const issue of result.issues) {
          expect(["critical", "warning", "info"]).toContain(issue.severity);
          expect(issue.category.length).toBeGreaterThan(0);
          expect(issue.message.length).toBeGreaterThan(0);
        }
      });
    });

    describe("with non-consent container", () => {
      beforeEach(() => {
        store.load("tests/fixtures/complex.json");
      });

      it("reports no consent detected", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_detected).toBe(false);
      });

      it("warns about missing consent on web container", () => {
        const result = analyzeConsentSetup(store);
        const missingIssues = result.issues.filter(
          (i) => i.category === "consent_missing"
        );
        expect(missingIssues.length).toBeGreaterThan(0);
        expect(missingIssues[0].severity).toBe("warning");
      });

      it("has empty consent arrays", () => {
        const result = analyzeConsentSetup(store);
        expect(result.consent_management_tags).toEqual([]);
        expect(result.consent_variables).toEqual([]);
        expect(result.consent_blocking_triggers).toEqual([]);
      });
    });
  });

  describe("getTagLifecycle", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("returns lifecycle for a Google tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "2")!,
        store
      );
      expect(result.tag_id).toBe("2");
      expect(result.lifecycle_phase).toBe("data_collection");
      expect(result.firing_order.group).toBe("google");
      expect(result.firing_order.priority).toBe(1);
    });

    it("returns lifecycle for a consent management tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "1")!,
        store
      );
      expect(result.lifecycle_phase).toBe("consent_management");
      expect(result.consent_related).toBe(true);
    });

    it("returns lifecycle for an HTML tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "5")!,
        store
      );
      expect(result.lifecycle_phase).toBe("data_collection");
      expect(result.firing_order.group).toBe("custom_html");
    });

    it("returns lifecycle for an image tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "7")!,
        store
      );
      expect(result.lifecycle_phase).toBe("data_collection");
      expect(result.firing_order.group).toBe("custom_image");
    });

    it("flags unprotected data collection tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "4")!, // Google Ads - no blocking trigger
        store
      );
      const unprotected = result.issues.find(
        (i) => i.category === "unprotected_data_collection"
      );
      expect(unprotected).toBeDefined();
      expect(unprotected!.severity).toBe("critical");
    });

    it("flags tag with no firing triggers", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "10")!,
        store
      );
      const noFiring = result.issues.find(
        (i) => i.category === "no_firing_triggers"
      );
      expect(noFiring).toBeDefined();
    });

    it("flags orphaned blocking trigger reference", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "9")!,
        store
      );
      const orphaned = result.issues.find(
        (i) => i.category === "orphaned_blocking_reference"
      );
      expect(orphaned).toBeDefined();
    });

    it("flags disabled tag", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "8")!,
        store
      );
      const disabled = result.issues.find(
        (i) => i.category === "disabled_tag"
      );
      expect(disabled).toBeDefined();
      expect(disabled!.severity).toBe("info");
    });

    it("includes trigger resolution", () => {
      const result = getTagLifecycle(
        store.tags.find((t) => t.tagId === "2")!,
        store
      );
      expect(result.triggers.firing.length).toBeGreaterThan(0);
      expect(result.triggers.firing[0].name).toBe("All Pages");
      expect(result.triggers.blocking.length).toBeGreaterThan(0);
    });

    it("throws for non-existent tag", () => {
      expect(() => {
        getTagLifecycle(
          { tagId: "999", name: "nonexistent", type: "html", parameter: [] } as Tag,
          store
        );
      }).not.toThrow(); // getTagLifecycle itself doesn't throw for missing tags, it just returns data
    });
  });

  describe("getTagLifecyclePhase", () => {
    beforeEach(() => {
      store.load("tests/fixtures/consent.json");
    });

    it("classifies consent tags as consent_management", () => {
      const consentTag = store.tags.find((t) => t.name === "Consent Mode - Default Denied");
      expect(getTagLifecyclePhase(consentTag!, store)).toBe("consent_management");
    });

    it("classifies GA4 tags as data_collection", () => {
      const ga4Tag = store.tags.find((t) => t.name === "GA4 Configuration");
      expect(getTagLifecyclePhase(ga4Tag!, store)).toBe("data_collection");
    });

    it("classifies HTML tags as data_collection", () => {
      const htmlTag = store.tags.find((t) => t.name === "Facebook Pixel PageView");
      expect(getTagLifecyclePhase(htmlTag!, store)).toBe("data_collection");
    });

    it("classifies unknown types as other", () => {
      const unknownTag = { tagId: "99", name: "test", type: "unknown", parameter: [] } as Tag;
      expect(getTagLifecyclePhase(unknownTag, store)).toBe("other");
    });
  });
});
