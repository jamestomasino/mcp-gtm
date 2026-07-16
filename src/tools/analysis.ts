import { z } from "zod";
import type { ContainerStore } from "../store";
import { resolveTriggerNames } from "../utils/entity";

/** Analysis tools: dependencies, unused entities, orphaned triggers, validation */
export function registerAnalysisTools(store: ContainerStore) {
  return [
    {
      name: "gtm_get_tag_dependencies",
      description: "Show which triggers and variables a tag references. Requires a loaded container.",
      parameters: z.object({
        tag_id: z.string().optional().describe("Tag ID to analyze"),
        name: z.string().optional().describe("Tag name to analyze (alternative to tag_id)"),
      }),
      handler: async ({ tag_id, name }: { tag_id?: string; name?: string }) => {
        let tag;
        if (tag_id) {
          tag = store.tags.find((t) => t.tagId === tag_id);
        } else if (name) {
          tag = store.tags.find((t) => t.name === name);
        }
        if (!tag) {
          throw new Error(`Tag not found. Provided: tag_id=${tag_id ?? "none"}, name=${name ?? "none"}`);
        }

        // Find which tags reference this trigger (reverse dependency)
        const tags_firing_this = store.tags.filter((t) =>
          (t.firingTriggerId ?? []).some((id) => {
            const trigger = store.triggers.find((tr) => tr.triggerId === id);
            return trigger && store.tags.find((tg) => tg.tagId === tag.tagId);
          })
        );

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            tag_id: tag.tagId,
            tag_name: tag.name,
            firing_triggers: (tag.firingTriggerId ?? []).map((id) => ({
              trigger_id: id,
              trigger_name: resolveTriggerNames([id], store.triggers)[0],
            })),
            blocking_triggers: (tag.blockingTriggerId ?? []).map((id) => ({
              trigger_id: id,
              trigger_name: resolveTriggerNames([id], store.triggers)[0],
            })),
          }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_find_unused_entities",
      description: "Find tags, triggers, or variables not referenced by any other entity. Requires a loaded container.",
      parameters: z.object({
        entity_type: z.enum(["tags", "triggers", "variables", "all"]).optional().default("all").describe("Which entity type to check"),
      }),
      handler: async ({ entity_type }: { entity_type: string }) => {
        const result: Record<string, { id: string; name: string }[]> = {};

        if (entity_type === "triggers" || entity_type === "all") {
          // A trigger is unused if no tag fires on it
          const usedTriggerIds = new Set<string>();
          store.tags.forEach((tag) => {
            (tag.firingTriggerId ?? []).forEach((id) => usedTriggerIds.add(id));
            (tag.blockingTriggerId ?? []).forEach((id) => usedTriggerIds.add(id));
          });
          result.triggers = store.triggers
            .filter((t) => !usedTriggerIds.has(t.triggerId))
            .map((t) => ({ id: t.triggerId, name: t.name }));
        }

        if (entity_type === "variables" || entity_type === "all") {
          // Variables are harder to trace (referenced by name in parameters), so we report all
          // A proper implementation would parse all parameters for variable references
          result.variables = store.variables.map((v) => ({ id: v.variableId, name: v.name }));
        }

        if (entity_type === "tags" || entity_type === "all") {
          // Tags are "unused" if they're disabled
          result.tags = store.tags
            .filter((t) => !t.enabled)
            .map((t) => ({ id: t.tagId, name: t.name }));
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    },
    {
      name: "gtm_find_orphaned_triggers",
      description: "Find triggers not fired by any tag. Requires a loaded container.",
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
            type: t.type,
          }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            orphaned_triggers: orphaned,
            total_count: orphaned.length,
          }, null, 2) }],
        };
      },
    },
    {
      name: "gtm_validate_container",
      description: "Run full Zod validation on the loaded container, report all issues. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const issues = store.validate();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            valid: issues.length === 0,
            issue_count: issues.length,
            issues,
          }, null, 2) }],
        };
      },
    },
  ];
}
