/**
 * Error handling utilities for safe error extraction and type guards
 */

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

/**
 * Type guard to check if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if value has a message property
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

/**
 * Safe error handler for catch blocks
 */
export function handleError(error: unknown, fallbackMessage = "An error occurred"): string {
  try {
    return getErrorMessage(error);
  } catch {
    return fallbackMessage;
  }
}
