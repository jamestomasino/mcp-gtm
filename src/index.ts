#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import { ContainerStore } from "./store";
import { registerContainerTools } from "./tools/container";
import { registerTagTools } from "./tools/tags";
import { registerTriggerTools } from "./tools/triggers";
import { registerVariableTools } from "./tools/variables";
import { registerFolderTools } from "./tools/folders";
import { registerAnalysisTools } from "./tools/analysis";
import { registerExportTools } from "./tools/export";
import { registerServerSideTools } from "./tools/serverSide";

const store = new ContainerStore();

const server = new McpServer({
  name: "mcp-gtm",
  version: "0.1.0",
});

// Read-only mode: skip write tools when GTM_READ_ONLY is set
const readOnly = process.env.GTM_READ_ONLY !== undefined;
const writeToolPrefixes = ["gtm_create_", "gtm_update_", "gtm_delete_", "gtm_move_", "gtm_export_"];

function isWriteTool(name: string): boolean {
  return writeToolPrefixes.some((prefix) => name.startsWith(prefix));
}

// Register all tool groups
const allTools = [
  ...registerContainerTools(store),
  ...registerTagTools(store),
  ...registerTriggerTools(store),
  ...registerVariableTools(store),
  ...registerFolderTools(store),
  ...registerAnalysisTools(store),
  ...registerExportTools(store),
  ...registerServerSideTools(store),
];

const toolsToRegister = readOnly ? allTools.filter((t) => !isWriteTool(t.name)) : allTools;

// Register each tool with the MCP server
for (const tool of toolsToRegister) {
  server.tool(
    tool.name,
    tool.description,
    tool.parameters.shape,
    async (params: Record<string, unknown>) => {
      try {
        return await tool.handler(params as never);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

// MCP Resources: container state snapshots
server.resource(
  "container_state",
  "gtm://container/state",
  async () => {
    if (!store.isLoaded) {
      return {
        contents: [{ uri: "gtm://container/state", mimeType: "text/plain", text: "No container loaded. Use gtm_load_container first." }],
      };
    }
    return {
      contents: [{
        uri: "gtm://container/state",
        mimeType: "application/json",
        text: JSON.stringify({
          loaded: true,
          source_path: store.sourcePath,
          container: store.containerInfo,
          counts: store.state,
        }, null, 2),
      }],
    };
  }
);

server.resource(
  "container_tags",
  "gtm://container/tags",
  async () => {
    if (!store.isLoaded) {
      return {
        contents: [{ uri: "gtm://container/tags", mimeType: "text/plain", text: "No container loaded." }],
      };
    }
    return {
      contents: [{
        uri: "gtm://container/tags",
        mimeType: "application/json",
        text: JSON.stringify({
          tags: store.tags.map((t) => ({
            tag_id: t.tagId,
            name: t.name,
            type: t.type,
            enabled: t.enabled ?? true,
            firing_trigger_ids: t.firingTriggerId ?? [],
            blocking_trigger_ids: t.blockingTriggerId ?? [],
            folder_id: t.parentFolderId ?? null,
          })),
          total_count: store.tags.length,
        }, null, 2),
      }],
    };
  }
);

server.resource(
  "container_triggers",
  "gtm://container/triggers",
  async () => {
    if (!store.isLoaded) {
      return {
        contents: [{ uri: "gtm://container/triggers", mimeType: "text/plain", text: "No container loaded." }],
      };
    }
    return {
      contents: [{
        uri: "gtm://container/triggers",
        mimeType: "application/json",
        text: JSON.stringify({
          triggers: store.triggers.map((t) => ({
            trigger_id: t.triggerId,
            name: t.name,
            type: t.type,
            folder_id: t.parentFolderId ?? null,
          })),
          total_count: store.triggers.length,
        }, null, 2),
      }],
    };
  }
);

server.resource(
  "container_variables",
  "gtm://container/variables",
  async () => {
    if (!store.isLoaded) {
      return {
        contents: [{ uri: "gtm://container/variables", mimeType: "text/plain", text: "No container loaded." }],
      };
    }
    return {
      contents: [{
        uri: "gtm://container/variables",
        mimeType: "application/json",
        text: JSON.stringify({
          variables: store.variables.map((v) => ({
            variable_id: v.variableId,
            name: v.name,
            type: v.type,
          })),
          total_count: store.variables.length,
        }, null, 2),
      }],
    };
  }
);

// MCP Prompts: common workflow templates
server.prompt(
  "inspect_container",
  "Inspect the GTM container: list all tags, triggers, and variables with resolved names",
  {},
  async () => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: "Please inspect the GTM container. List all tags, triggers, and variables. Resolve trigger IDs to trigger names and folder IDs to folder names where possible. Summarize the findings.",
        },
      }],
    };
  }
);

server.prompt(
  "audit_container",
  "Audit the container for issues: find unused entities, orphaned triggers, and disabled tags",
  {},
  async () => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: "Please audit the GTM container. Find all disabled tags, orphaned triggers (not fired by any tag), and unused entities. Present cleanup recommendations.",
        },
      }],
    };
  }
);

server.prompt(
  "debug_tag",
  "Debug why a specific tag might not be firing",
  {
    tag_identifier: z.string().describe("Tag ID or name to debug"),
  },
  async ({ tag_identifier }) => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Debug why the tag "${tag_identifier}" might not be firing. Check its trigger configuration, filter conditions, blocking triggers, and dependencies. Identify any misconfigurations.`,
        },
      }],
    };
  }
);

server.prompt(
  "compare_containers",
  "Compare two GTM container files and report differences",
  {
    file_a: z.string().describe("Path to the first container JSON file"),
    file_b: z.string().describe("Path to the second container JSON file"),
  },
  async ({ file_a, file_b }) => {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Compare these two GTM container files: ${file_a} vs ${file_b}. Report what tags, triggers, and variables were added, removed, or modified. Summarize the differences.`,
        },
      }],
    };
  }
);

// Auto-load container from environment variable if provided
const envContainerFile = process.env.GTM_CONTAINER_FILE;
if (envContainerFile) {
  try {
    store.load(envContainerFile);
    console.error(`Auto-loaded container from ${envContainerFile}`);
  } catch (error) {
    console.error(`Failed to auto-load container from ${envContainerFile}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-gtm server ready");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
