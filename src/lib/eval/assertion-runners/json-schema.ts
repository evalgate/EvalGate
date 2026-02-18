/**
 * JSON Schema assertion runner.
 * Validates that output is valid JSON and optionally matches expected structure.
 */

import type { AssertionResult } from "@/lib/eval/assertions";

/** Check if output is valid JSON. Optionally validate against expected keys. */
export function runJsonSchemaAssertion(
  output: string,
  options?: { requiredKeys?: string[] },
): AssertionResult {
  let passed = false;
  let details: string | undefined;

  try {
    const parsed = JSON.parse(output);
    if (typeof parsed !== "object" || parsed === null) {
      passed = false;
      details = "Output must be a JSON object";
    } else if (options?.requiredKeys?.length) {
      const missing = options.requiredKeys.filter((k) => !(k in parsed));
      passed = missing.length === 0;
      details = missing.length > 0 ? `Missing keys: ${missing.join(", ")}` : undefined;
    } else {
      passed = true;
    }
  } catch {
    passed = false;
    details = "Output is not valid JSON";
  }

  return {
    key: "json_schema",
    category: "format",
    passed,
    details,
  };
}
