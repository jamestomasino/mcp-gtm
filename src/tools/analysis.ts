import { z } from "zod";
import type { ContainerStore } from "../store";
import { resolveTriggerNames } from "../utils/entity";
import { textResult } from "../utils/response";
import {
  getTagTypeName,
  getTriggerTypeName,
  getVariableTypeName
} from "../utils/typeCodes";

/**
 * Extract all {{variable}} references from a parameter list.
 * Handles nested lists (MAP, LIST types) recursively.
 */
function extractVariableReferences(value: unknown): string[] {
  const refs = new Set<string>();
  function walk(v: unknown) {
    if (typeof v === "string") {
      const matches = v.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        for (const m of matches) {
          refs.add(m.slice(2, -2));
        }
      }
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (v && typeof v === "object") {
      for (const val of Object.values(v)) walk(val);
    }
  }
  walk(value);
  return [...refs];
}

/**
 * Collect all parameter blocks from tags and triggers, then extract variable references.
 */
function collectReferencedVariableNames(store: ContainerStore): Set<string> {
  const referenced = new Set<string>();

  for (const tag of store.tags) {
    if (Array.isArray(tag.parameter)) {
      for (const param of tag.parameter) {
        const refs = extractVariableReferences(param.value);
        refs.forEach((r) => referenced.add(r));
        if (Array.isArray(param.list)) {
          for (const item of param.list) {
            const itemRefs = extractVariableReferences(item);
            itemRefs.forEach((r) => referenced.add(r));
          }
        }
      }
    }
  }

  for (const trigger of store.triggers) {
    if (Array.isArray(trigger.filter)) {
      for (const filt of trigger.filter) {
        if (Array.isArray(filt?.parameter)) {
          for (const param of filt.parameter) {
            const refs = extractVariableReferences(param.value);
            refs.forEach((r) => referenced.add(r));
          }
        }
      }
    }
    if (Array.isArray(trigger.parameter)) {
      for (const param of trigger.parameter) {
        const refs = extractVariableReferences(param.value);
        refs.forEach((r) => referenced.add(r));
        if (Array.isArray(param.list)) {
          for (const item of param.list) {
            const itemRefs = extractVariableReferences(item);
            itemRefs.forEach((r) => referenced.add(r));
          }
        }
      }
    }
  }

  for (const variable of store.variables) {
    if (Array.isArray(variable.parameter)) {
      for (const param of variable.parameter) {
        const refs = extractVariableReferences(param.value);
        refs.forEach((r) => referenced.add(r));
        if (Array.isArray(param.list)) {
          for (const item of param.list) {
            const itemRefs = extractVariableReferences(item);
            itemRefs.forEach((r) => referenced.add(r));
          }
        }
      }
    }
  }

  return referenced;
}

/** Analysis tools: dependencies, unused entities, orphaned triggers, validation */
export function registerAnalysisTools(store: ContainerStore) {
  return [
    {
      name: "gtm_get_tag_dependencies",
      description:
        "Show which triggers and variables a tag references. Requires a loaded container.",
      parameters: z.object({
        tag_id: z.string().optional().describe("Tag ID to analyze"),
        name: z
          .string()
          .optional()
          .describe("Tag name to analyze (alternative to tag_id)")
      }),
      handler: async ({ tag_id, name }: { tag_id?: string; name?: string }) => {
        let tag;
        if (tag_id) {
          tag = store.tags.find((t) => t.tagId === tag_id);
        } else if (name) {
          tag = store.tags.find((t) => t.name === name);
        }
        if (!tag) {
          throw new Error(
            `Tag not found. Provided: tag_id=${tag_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult({
          tag_id: tag.tagId,
          tag_name: tag.name,
          firing_triggers: (tag.firingTriggerId ?? []).map((id) => ({
            trigger_id: id,
            trigger_name: resolveTriggerNames([id], store.triggers)[0]
          })),
          blocking_triggers: (tag.blockingTriggerId ?? []).map((id) => ({
            trigger_id: id,
            trigger_name: resolveTriggerNames([id], store.triggers)[0]
          }))
        });
      }
    },
    {
      name: "gtm_find_unused_entities",
      description:
        "Find tags, triggers, or variables not referenced by any other entity. Variables are classified by type (data_layer, custom_js, constant, lookup_table, etc.) and only those with no parameter references anywhere are reported unused. Requires a loaded container.",
      parameters: z.object({
        entity_type: z
          .enum(["tags", "triggers", "variables", "all"])
          .optional()
          .default("all")
          .describe("Which entity type to check")
      }),
      handler: async ({ entity_type }: { entity_type: string }) => {
        const result: Record<
          string,
          { id: string; name: string; type?: string; type_name?: string }[]
        > = {};

        if (entity_type === "triggers" || entity_type === "all") {
          const usedTriggerIds = new Set<string>();
          store.tags.forEach((tag) => {
            (tag.firingTriggerId ?? []).forEach((id) => usedTriggerIds.add(id));
            (tag.blockingTriggerId ?? []).forEach((id) =>
              usedTriggerIds.add(id)
            );
          });
          result.triggers = store.triggers
            .filter((t) => !usedTriggerIds.has(t.triggerId))
            .map((t) => ({
              id: t.triggerId,
              name: t.name,
              type: t.type,
              type_name: getTriggerTypeName(t.type)
            }));
        }

        if (entity_type === "variables" || entity_type === "all") {
          const referencedNames = collectReferencedVariableNames(store);
          result.variables = store.variables
            .filter((v) => !referencedNames.has(v.name))
            .map((v) => ({
              id: v.variableId,
              name: v.name,
              type: v.type,
              type_name: getVariableTypeName(v.type)
            }));
        }

        if (entity_type === "tags" || entity_type === "all") {
          result.tags = store.tags
            .filter((t) => !t.enabled)
            .map((t) => ({
              id: t.tagId,
              name: t.name,
              type: t.type,
              type_name: getTagTypeName(t.type)
            }));
        }

        return textResult(result);
      }
    },
    {
      name: "gtm_find_orphaned_triggers",
      description:
        "Find triggers not fired by any tag. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const usedTriggerIds = new Set<string>();
        store.tags.forEach((tag) => {
          (tag.firingTriggerId ?? []).forEach((id) => usedTriggerIds.add(id));
        });
        const orphaned = store.triggers
          .filter((t) => !usedTriggerIds.has(t.triggerId))
          .map((t) => ({
            trigger_id: t.triggerId,
            name: t.name,
            type: t.type
          }));
        return textResult({
          orphaned_triggers: orphaned,
          total_count: orphaned.length
        });
      }
    },
    {
      name: "gtm_validate_container",
      description:
        "Run full Zod validation on the loaded container, report all issues. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const issues = store.validate();
        return textResult({
          valid: issues.length === 0,
          issue_count: issues.length,
          issues
        });
      }
    }
  ];
}
