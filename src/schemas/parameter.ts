import { z } from "zod";

/**
 * Shared ParameterSchema — used by tags, triggers, and variables.
 * GTM parameters are key/value pairs with optional type hints.
 * Real exports may use 'list' instead of 'value' for complex types (LIST, MAP, etc.).
 */
export const ParameterSchema = z.object({
  key: z.string(),
  type: z.string().optional(),
  value: z.any().optional(),
  list: z.array(z.any()).optional(),
}).passthrough();

export const ParameterListSchema = z.array(ParameterSchema).optional();

export type Parameter = z.infer<typeof ParameterSchema>;
export type ParameterList = z.infer<typeof ParameterListSchema>;
