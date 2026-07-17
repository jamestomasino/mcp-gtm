import { z } from "zod";
import { ParameterListSchema } from "./parameter";

/**
 * VariableSchema — represents a user-defined GTM variable.
 */
export const VariableSchema = z
  .object({
    variableId: z.string(),
    fingerprint: z.string().optional(),
    name: z.string(),
    type: z.string(), // v (Data Layer), u (URL), jsm (Custom JS), smm (Lookup Table), etc.
    parameter: ParameterListSchema,
    notes: z.string().optional()
  })
  .passthrough();

/**
 * BuiltInVariableSchema — represents an enabled built-in variable.
 */
export const BuiltInVariableSchema = z
  .object({
    name: z.string(), // Click Element, Page Path, etc.
    type: z.string()
  })
  .passthrough();

export type Variable = z.infer<typeof VariableSchema>;
export type BuiltInVariable = z.infer<typeof BuiltInVariableSchema>;
