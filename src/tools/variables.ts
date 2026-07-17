import { z } from "zod";
import type { Variable } from "../schemas/variable";
import type { ContainerStore } from "../store";
import { textResult } from "../utils/response";
import { getVariableTypeName } from "../utils/typeCodes";

/** Variable tools (CRUD + built-in) */
export function registerVariableTools(store: ContainerStore) {
  return [
    {
      name: "gtm_list_variables",
      description:
        "List all user-defined variables with summary info. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        const variables = store.variables.map((v) => ({
          variable_id: v.variableId,
          name: v.name,
          type: v.type,
          type_name: getVariableTypeName(v.type),
          notes: v.notes ?? null
        }));
        return textResult({ variables, total_count: variables.length });
      }
    },
    {
      name: "gtm_get_variable",
      description:
        "Get variable details by variable_id or name. Requires a loaded container.",
      parameters: z.object({
        variable_id: z.string().optional().describe("Variable ID to look up"),
        name: z
          .string()
          .optional()
          .describe("Variable name to look up (alternative to variable_id)")
      }),
      handler: async ({
        variable_id,
        name
      }: {
        variable_id?: string;
        name?: string;
      }) => {
        let variable;
        if (variable_id) {
          variable = store.variables.find((v) => v.variableId === variable_id);
        } else if (name) {
          variable = store.variables.find((v) => v.name === name);
        }
        if (!variable) {
          throw new Error(
            `Variable not found. Provided: variable_id=${variable_id ?? "none"}, name=${name ?? "none"}`
          );
        }
        return textResult({
          ...variable,
          type_name: getVariableTypeName(variable.type)
        });
      }
    },
    {
      name: "gtm_create_variable",
      description:
        "Create a new variable. Validates against GTM schema, auto-assigns variableId if not provided.",
      parameters: z.object({
        name: z.string().describe("Variable name"),
        type: z
          .string()
          .describe(
            "Variable type code (e.g. v for Data Layer, u for URL, jsm for Custom JS)"
          ),
        notes: z.string().optional().describe("Notes for the variable"),
        parameters: z
          .array(
            z.object({
              key: z.string(),
              value: z.union([z.string(), z.number(), z.boolean()]),
              type: z.string().optional()
            })
          )
          .optional()
          .describe("Variable configuration parameters")
      }),
      handler: async (params: Record<string, unknown>) => {
        const variable = store.createVariable({
          name: params.name,
          type: params.type,
          notes: params.notes,
          parameter: params.parameters
        });
        return textResult({
          status: "created",
          variable,
          type_name: getVariableTypeName(variable.type)
        });
      }
    },
    {
      name: "gtm_update_variable",
      description: "Update an existing variable by variable_id.",
      parameters: z.object({
        variable_id: z.string().describe("Variable ID to update"),
        name: z.string().optional().describe("New variable name"),
        notes: z.string().optional().describe("New notes"),
        parameters: z
          .array(
            z.object({
              key: z.string(),
              value: z.union([z.string(), z.number(), z.boolean()]),
              type: z.string().optional()
            })
          )
          .optional()
          .describe("Updated variable configuration parameters")
      }),
      handler: async ({
        variable_id,
        ...updates
      }: {
        variable_id: string;
        [key: string]: unknown;
      }) => {
        const updatesObj: Record<string, string | unknown[]> = {};
        if (updates.name !== undefined)
          updatesObj.name = updates.name as string;
        if (updates.notes !== undefined)
          updatesObj.notes = updates.notes as string;
        if (updates.parameters !== undefined && updates.parameters !== null) {
          updatesObj.parameter = updates.parameters as unknown[];
        }
        const variable = store.updateVariable(
          variable_id,
          updatesObj as Partial<Variable>
        );
        return textResult({ status: "updated", variable });
      }
    },
    {
      name: "gtm_delete_variable",
      description: "Delete a variable from the container by variable_id.",
      parameters: z.object({
        variable_id: z.string().describe("Variable ID to delete")
      }),
      handler: async ({ variable_id }: { variable_id: string }) => {
        const deleted = store.deleteVariable(variable_id);
        if (!deleted) throw new Error(`Variable not found: ${variable_id}`);
        return textResult({ status: "deleted", variable_id });
      }
    },
    {
      name: "gtm_list_builtin_variables",
      description:
        "List enabled built-in variables. Requires a loaded container.",
      parameters: z.object({}),
      handler: async () => {
        return textResult({
          builtInVariables: store.builtInVariables,
          total_count: store.builtInVariables.length
        });
      }
    }
  ];
}
