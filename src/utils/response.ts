/**
 * Helper to create a standard MCP tool text response.
 * Wraps data in the MCP response envelope and pretty-prints JSON.
 */
export function textResult(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}
