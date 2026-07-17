/**
 * Error categories for structured error responses.
 * Allow LLM clients to distinguish error types programmatically.
 */
export const ErrorCategories = {
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

export type ErrorCategory =
  (typeof ErrorCategories)[keyof typeof ErrorCategories];

// ---------------------------------------------------------------------------
// Custom error classes — replace fragile string-matching categorization
// ---------------------------------------------------------------------------

export class GtmError extends Error {
  public readonly category: ErrorCategory;

  constructor(message: string, category: ErrorCategory) {
    super(message);
    this.category = category;
  }
}

export class ContainerNotLoadedError extends GtmError {
  constructor(message = "No container loaded. Call gtm_load_container first.") {
    super(message, ErrorCategories.NOT_LOADED);
  }
}

export class EntityNotFoundError extends GtmError {
  constructor(message: string) {
    super(message, ErrorCategories.NOT_FOUND);
  }
}

export class ValidationError extends GtmError {
  constructor(message: string) {
    super(message, ErrorCategories.VALIDATION);
  }
}

export class IoError extends GtmError {
  constructor(message: string) {
    super(message, ErrorCategories.IO);
  }
}

export class DisabledError extends GtmError {
  constructor(message: string) {
    super(message, ErrorCategories.DISABLED);
  }
}

// ---------------------------------------------------------------------------
// Legacy categorizeError for backward compatibility
// ---------------------------------------------------------------------------

/**
 * Categorize an error into a structured error category.
 * Handles GtmError subclasses directly, falls back to string matching for plain Errors.
 */
export function categorizeError(error: unknown): {
  category: ErrorCategory;
  message: string;
} {
  if (error instanceof GtmError) {
    return { category: error.category, message: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);

  // Fallback: string matching for errors thrown outside our control
  if (message.includes("No container loaded")) {
    return { category: ErrorCategories.NOT_LOADED, message };
  }
  if (message.includes("not found")) {
    return { category: ErrorCategories.NOT_FOUND, message };
  }
  if (message.startsWith("Invalid ")) {
    return { category: ErrorCategories.VALIDATION, message };
  }
  if (message.includes("ENOENT") || message.includes("EACCES")) {
    return { category: ErrorCategories.IO, message };
  }
  if (message.includes("read-only") || message.includes("disabled")) {
    return { category: ErrorCategories.DISABLED, message };
  }

  return { category: ErrorCategories.INTERNAL, message };
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
