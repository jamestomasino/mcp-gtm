import { z } from "zod";

/**
 * ConditionSchema — used by trigger filters.
 * A condition is a pair of arguments compared by an operator (equals, not_equals, etc.).
 */
export const ConditionSchema = z
  .object({
    type: z.string(), // equals, not_equals, contains, matches, etc.
    parameter: z
      .array(
        z.object({
          key: z.string(),
          type: z.string().optional(),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.object({ field: z.string() }),
            z.array(z.any())
          ])
        })
      )
      .optional()
  })
  .passthrough();

export const ConditionListSchema = z.array(ConditionSchema).optional();

export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionList = z.infer<typeof ConditionListSchema>;
