import { z } from "zod";
import type { ContainerStore } from "../store";
import { getUsageContextNames } from "../utils/typeCodes";
import { textResult } from "../utils/response";

/** Container-level read-only tools */
export function registerContainerTools(store: ContainerStore) {
  return [
    {
      name: "gtm_load_container",
      description:
        "Load a GTM container JSON file. Call this first before using any other tools.",
      parameters: z.object({
        file_path: z.string().describe("Path to the GTM export JSON file")
      }),
      handler: async ({ file_path }: { file_path: string }) => {
        store.load(file_path);
        const info = store.containerInfo;
        const state = store.state;
        return textResult({
          status: "loaded",
          file_path,
          container: info,
          counts: state
        });
      }
    },
    {
      name: "gtm_get_container_info",
      description:
        "Get container metadata (name, ID, timezone, platform). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const info = store.containerInfo;
        return textResult({
          ...info,
          usageContextNames: getUsageContextNames(info.usageContext)
        });
      }
    },
    {
      name: "gtm_get_container_state",
      description:
        "Get summary counts and structure overview of the loaded container.",
      parameters: z.object({}),
      handler: async () => {
        return textResult({
          ...store.state,
          source_path: store.sourcePath
        });
      }
    }
  ];
}
