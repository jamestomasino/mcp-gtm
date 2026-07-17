import { z } from "zod";
import type { ContainerStore } from "../store";
import { textResult } from "../utils/response";

/** Server-side GTM tools (zones, clients, transformations, custom templates) */
export function registerServerSideTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_zones",
      description:
        "List all zones in the container (server-side GTM). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const zones = store.zones.map((zone) => ({
          zone_id: zone.zoneId,
          name: zone.name,
          type: zone.type,
          notes: zone.notes ?? null
        }));
        return textResult({ zones, total_count: zones.length });
      }
    },
    {
      name: "gtm_get_zone",
      description:
        "Get zone details by zone_id or name (server-side GTM). Requires a loaded container.",
      parameters: z.object({
        zone_id: z.string().optional().describe("Zone ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Zone name to look up (alternative to zone_id)")
      }),
      handler: async ({
        zone_id,
        name
      }: {
        zone_id?: string;
        name?: string;
      }) => {
        let zone;
        if (zone_id) {
          zone = store.zones.find((z) => z.zoneId === zone_id);
        } else if (name) {
          zone = store.zones.find((z) => z.name === name);
        }
        if (!zone) {
          throw new Error(
            `Zone not found. Provided: zone_id=${zone_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult(zone);
      }
    },
    {
      name: "gtm_list_clients",
      description:
        "List all clients in the container (server-side GTM). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const clients = store.clients.map((client) => ({
          client_id: client.clientId,
          name: client.name,
          type: client.type,
          notes: client.notes ?? null
        }));
        return textResult({ clients, total_count: clients.length });
      }
    },
    {
      name: "gtm_get_client",
      description:
        "Get client details by client_id or name (server-side GTM). Requires a loaded container.",
      parameters: z.object({
        client_id: z.string().optional().describe("Client ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Client name to look up (alternative to client_id)")
      }),
      handler: async ({
        client_id,
        name
      }: {
        client_id?: string;
        name?: string;
      }) => {
        let client;
        if (client_id) {
          client = store.clients.find((c) => c.clientId === client_id);
        } else if (name) {
          client = store.clients.find((c) => c.name === name);
        }
        if (!client) {
          throw new Error(
            `Client not found. Provided: client_id=${client_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult(client);
      }
    },
    {
      name: "gtm_list_transformations",
      description:
        "List all transformations in the container (server-side GTM). Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const transformations = store.transformations.map((t) => ({
          transformation_id: t.transformationId,
          name: t.name,
          type: t.type,
          notes: t.notes ?? null
        }));
        return textResult({ transformations, total_count: transformations.length });
      }
    },
    {
      name: "gtm_get_transformation",
      description:
        "Get transformation details by transformation_id or name (server-side GTM). Requires a loaded container.",
      parameters: z.object({
        transformation_id: z
          .string()
          .optional()
          .describe("Transformation ID to look up"),
        name: z
          .string()
          .optional()
          .describe(
            "Transformation name to look up (alternative to transformation_id)"
          )
      }),
      handler: async ({
        transformation_id,
        name
      }: {
        transformation_id?: string;
        name?: string;
      }) => {
        let transformation;
        if (transformation_id) {
          transformation = store.transformations.find(
            (t) => t.transformationId === transformation_id
          );
        } else if (name) {
          transformation = store.transformations.find((t) => t.name === name);
        }
        if (!transformation) {
          throw new Error(
            `Transformation not found. Provided: transformation_id=${transformation_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult(transformation);
      }
    },
    {
      name: "gtm_list_custom_templates",
      description:
        "List all custom templates in the container. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const templates = store.customTemplates.map((t) => ({
          template_id: t.templateId,
          name: t.name,
          type: t.type,
          notes: t.notes ?? null
        }));
        return textResult({ custom_templates: templates, total_count: templates.length });
      }
    },
    {
      name: "gtm_get_custom_template",
      description:
        "Get custom template details by template_id or name. Requires a loaded container.",
      parameters: z.object({
        template_id: z.string().optional().describe("Template ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Template name to look up (alternative to template_id)")
      }),
      handler: async ({
        template_id,
        name
      }: {
        template_id?: string;
        name?: string;
      }) => {
        let template;
        if (template_id) {
          template = store.customTemplates.find(
            (t) => t.templateId === template_id
          );
        } else if (name) {
          template = store.customTemplates.find((t) => t.name === name);
        }
        if (!template) {
          throw new Error(
            `Custom template not found. Provided: template_id=${template_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult(template);
      }
    }
  ];
}
