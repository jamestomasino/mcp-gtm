import { z } from "zod";

/**
 * Shared ParameterSchema — used by tags, triggers, and variables.
 * GTM parameters are key/value pairs with optional type hints.
 */
export const ParameterSchema = z.object({
  key: z.string(),
  type: z.string().optional(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({ field: z.string() }),
    z.array(z.any()),
  ]),
}).passthrough();

export const ParameterListSchema = z.array(ParameterSchema).optional();

export type Parameter = z.infer<typeof ParameterSchema>;
export type ParameterList = z.infer<typeof ParameterListSchema>;
