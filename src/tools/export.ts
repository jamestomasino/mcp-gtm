import { readFileSync } from "node:fs";
import { z } from "zod";
import { GtmExportSchema } from "../schemas/export";
import type { ContainerStore } from "../store";

/** Export and diff tools */
export function registerExportTools(store: ContainerStore) {
  return [
    {
      name: "gtm_export_container",
      description:
        "Write current container state to a JSON file. The file can be imported back into GTM.",
      parameters: z.object({
        file_path: z
          .string()
          .describe("Output file path for the exported container JSON")
      }),
      handler: async ({ file_path }: { file_path: string }) => {
        store.exportTo(file_path);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "exported",
                  file_path,
                  counts: store.state
                },
                null,
                2
              )
            }
          ]
        };
      }
    },
    {
      name: "gtm_diff_containers",
      description:
        "Compare two container JSON files and report differences in tags, triggers, and variables.",
      parameters: z.object({
        file_a: z
          .string()
          .describe("Path to the first GTM container JSON file"),
        file_b: z
          .string()
          .describe("Path to the second GTM container JSON file")
      }),
      handler: async ({
        file_a,
        file_b
      }: {
        file_a: string;
        file_b: string;
      }) => {
        const parseContainer = (path: string) => {
          const raw = readFileSync(path, "utf-8");
          const parsed = JSON.parse(raw);
          const result = GtmExportSchema.safeParse(parsed);
          if (!result.success) {
            throw new Error(
              `Invalid GTM container at ${path}: ${result.error.errors.map((e) => e.message).join("; ")}`
            );
          }
          return result.data.containerVersion.container;
        };

        const containerA = parseContainer(file_a);
        const containerB = parseContainer(file_b);

        const tagsA = new Map(
          (containerA.tag ?? []).map((t) => [t.tagId, t.name])
        );
        const tagsB = new Map(
          (containerB.tag ?? []).map((t) => [t.tagId, t.name])
        );
        const triggersA = new Map(
          (containerA.trigger ?? []).map((t) => [t.triggerId, t.name])
        );
        const triggersB = new Map(
          (containerB.trigger ?? []).map((t) => [t.triggerId, t.name])
        );
        const varsA = new Map(
          (containerA.userDefinedVariable ?? []).map((v) => [
            v.variableId,
            v.name
          ])
        );
        const varsB = new Map(
          (containerB.userDefinedVariable ?? []).map((v) => [
            v.variableId,
            v.name
          ])
        );

        const diff = {
          tags: {
            added: [...tagsB.keys()]
              .filter((id) => !tagsA.has(id))
              .map((id) => ({ id, name: tagsB.get(id) })),
            removed: [...tagsA.keys()]
              .filter((id) => !tagsB.has(id))
              .map((id) => ({ id, name: tagsA.get(id) })),
            count_a: tagsA.size,
            count_b: tagsB.size
          },
          triggers: {
            added: [...triggersB.keys()]
              .filter((id) => !triggersA.has(id))
              .map((id) => ({ id, name: triggersB.get(id) })),
            removed: [...triggersA.keys()]
              .filter((id) => !triggersB.has(id))
              .map((id) => ({ id, name: triggersA.get(id) })),
            count_a: triggersA.size,
            count_b: triggersB.size
          },
          variables: {
            added: [...varsB.keys()]
              .filter((id) => !varsA.has(id))
              .map((id) => ({ id, name: varsB.get(id) })),
            removed: [...varsA.keys()]
              .filter((id) => !varsB.has(id))
              .map((id) => ({ id, name: varsA.get(id) })),
            count_a: varsA.size,
            count_b: varsB.size
          }
        };

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(diff, null, 2) }
          ]
        };
      }
    }
  ];
}
