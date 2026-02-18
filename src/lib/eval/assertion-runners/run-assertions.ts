/**
 * runAssertions — run enabled assertion producers and return canonical envelope.
 * Used inside evaluation execution when assertions are enabled.
 */

import type { AssertionResult, AssertionsEnvelope } from "@/lib/eval/assertions";
import { runJsonSchemaAssertion } from "./json-schema";
import { runPiiAssertion } from "./pii";
import { runToxicityAssertion } from "./toxicity";

export type AssertionRunnerKey = "json_schema" | "pii" | "toxicity";

const RUNNERS: Record<
  AssertionRunnerKey,
  (output: string, options?: Record<string, unknown>) => AssertionResult
> = {
  json_schema: (out, opts) => runJsonSchemaAssertion(out, opts as { requiredKeys?: string[] }),
  pii: (out) => runPiiAssertion(out),
  toxicity: (out) => runToxicityAssertion(out),
};

/** Known assertion keys — unknown keys are rejected at write boundary */
export const KNOWN_ASSERTION_KEYS: AssertionRunnerKey[] = ["json_schema", "pii", "toxicity"];

/**
 * Run enabled assertions on output and return canonical envelope.
 * @param output — The LLM/output string to check
 * @param enabled — Which assertions to run (default: pii, toxicity for safety)
 */
export function runAssertions(
  output: string,
  enabled: AssertionRunnerKey[] = ["pii", "toxicity"],
): AssertionsEnvelope {
  const assertions: AssertionResult[] = [];
  for (const key of enabled) {
    const runner = RUNNERS[key];
    if (runner) {
      assertions.push(runner(output));
    }
  }
  return { version: "v1", assertions };
}
