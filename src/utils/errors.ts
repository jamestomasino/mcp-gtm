/**
 * Error categories for structured error responses.
 * Allow LLM clients to distinguish error types programmatically.
 */
export const ErrorCategory = {
  /** No container loaded or already unloaded */
  NOT_LOADED: "not_loaded",
  /** Entity not found (tag, trigger, variable, folder) */
  NOT_FOUND: "not_found",
  /** Invalid input or parameter validation failure */
  INVALID_INPUT: "invalid_input",
  /** Zod schema validation failure */
  VALIDATION: "validation",
  /** File I/O error (read/write/export) */
  IO: "io",
  /** Operation disabled (e.g. read-only mode) */
  DISABLED: "disabled",
  /** Unexpected or internal error */
  INTERNAL: "internal"
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Categorize an error message into a structured error category.
 */
export function categorizeError(error: unknown): {
  category: ErrorCategory;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("No container loaded")) {
    return { category: ErrorCategory.NOT_LOADED, message };
  }
  if (
    message.includes("not found") ||
    message.includes("Tag not found") ||
    message.includes("Trigger not found") ||
    message.includes("Variable not found") ||
    message.includes("Folder not found") ||
    message.includes("Zone not found") ||
    message.includes("Client not found") ||
    message.includes("Transformation not found") ||
    message.includes("Custom template not found")
  ) {
    return { category: ErrorCategory.NOT_FOUND, message };
  }
  if (message.startsWith("Invalid ")) {
    return { category: ErrorCategory.VALIDATION, message };
  }
  if (message.includes("ENOENT") || message.includes("EACCES")) {
    return { category: ErrorCategory.IO, message };
  }
  if (message.includes("read-only") || message.includes("disabled")) {
    return { category: ErrorCategory.DISABLED, message };
  }
  if (message.includes("Invalid parameter")) {
    return { category: ErrorCategory.INVALID_INPUT, message };
  }

  return { category: ErrorCategory.INTERNAL, message };
}

/**
 * Format a structured error response for MCP tool results.
 */
export function formatError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const { category, message } = categorizeError(error);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: true, category, message }, null, 2)
      }
    ],
    isError: true
  };
}
