import { z } from "zod";
import type { ContainerStore } from "../store";
import {
  getTagTypeName,
  getTriggerTypeName,
  getVariableTypeName
} from "../utils/typeCodes";

export function registerSearchTools(store: ContainerStore) {
  return [
    {
      name: "gtm_search",
      description:
        "Search across all entities (tags, triggers, variables, folders) by name or notes. Returns matching entities with their type and summary info. Requires a loaded container.",
      parameters: z.object({
        query: z
          .string()
          .describe("Search query (matched against entity names and notes)"),
        entity_type: z
          .enum(["tags", "triggers", "variables", "folders", "all"])
          .optional()
          .default("all")
          .describe("Which entity types to search"),
        case_sensitive: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether the search is case-sensitive")
      }),
      handler: async ({
        query,
        entity_type,
        case_sensitive
      }: {
        query: string;
        entity_type: string;
        case_sensitive: boolean;
      }) => {
        const results: Array<{
          entity_type: string;
          id: string;
          name: string;
          type?: string;
          type_name?: string;
          match_field: "name" | "notes";
          enabled?: boolean;
        }> = [];

        const match = (text: string | undefined | null): boolean => {
          if (!text) return false;
          if (case_sensitive) return text.includes(query);
          return text.toLowerCase().includes(query.toLowerCase());
        };

        if (entity_type === "tags" || entity_type === "all") {
          for (const tag of store.tags) {
            const nameMatch = match(tag.name);
            const notesMatch = match(tag.notes);
            if (nameMatch || notesMatch) {
              results.push({
                entity_type: "tag",
                id: tag.tagId,
                name: tag.name,
                type: tag.type,
                type_name: getTagTypeName(tag.type),
                match_field: nameMatch ? "name" : "notes",
                enabled: tag.enabled !== false
              });
            }
          }
        }

        if (entity_type === "triggers" || entity_type === "all") {
          for (const trigger of store.triggers) {
            const nameMatch = match(trigger.name);
            const notesMatch = match(trigger.notes);
            if (nameMatch || notesMatch) {
              results.push({
                entity_type: "trigger",
                id: trigger.triggerId,
                name: trigger.name,
                type: trigger.type,
                type_name: getTriggerTypeName(trigger.type),
                match_field: nameMatch ? "name" : "notes"
              });
            }
          }
        }

        if (entity_type === "variables" || entity_type === "all") {
          for (const variable of store.variables) {
            const nameMatch = match(variable.name);
            const notesMatch = match(variable.notes);
            if (nameMatch || notesMatch) {
              results.push({
                entity_type: "variable",
                id: variable.variableId,
                name: variable.name,
                type: variable.type,
                type_name: getVariableTypeName(variable.type),
                match_field: nameMatch ? "name" : "notes"
              });
            }
          }
        }

        if (entity_type === "folders" || entity_type === "all") {
          for (const folder of store.folders) {
            const nameMatch = match(folder.name);
            const notesMatch = match(folder.notes);
            if (nameMatch || notesMatch) {
              results.push({
                entity_type: "folder",
                id: folder.folderId,
                name: folder.name,
                match_field: nameMatch ? "name" : "notes"
              });
            }
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  query,
                  total_matches: results.length,
                  results
                },
                null,
                2
              )
            }
          ]
        };
      }
    }
  ];
}
