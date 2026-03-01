/**
 * openAIChatEval — One-function OpenAI chat regression testing
 *
 * Run local regression tests with OpenAI. No EvalGate account required.
 * CI-friendly output. Optional reportToEvalGate in v1.5.
 *
 * @example
 * ```typescript
 * import { openAIChatEval } from '@evalgate/sdk';
 *
 * await openAIChatEval({
 *   name: 'chat-regression',
 *   cases: [
 *     { input: 'Hello', expectedOutput: 'greeting' },
 *     { input: '2 + 2 = ?', expectedOutput: '4' }
 *   ]
 * });
 * ```
 */
import type { TestSuiteCaseResult } from "../testing";
export interface OpenAIChatEvalCase {
    input: string;
    expectedOutput?: string;
    /** Platform test case ID. When provided, used directly for reportToEvalGate (no input matching). */
    testCaseId?: number;
    assertions?: ((output: string) => import("../assertions").AssertionResult)[];
}
export interface OpenAIChatEvalOptions {
    name: string;
    model?: string;
    apiKey?: string;
    cases: OpenAIChatEvalCase[];
    /** Retry failing cases N times (default: 0). Only failing cases are retried. */
    retries?: number;
    /** v1.5: Upload results to EvalGate platform for an existing evaluation. Requires evaluationId and EVALGATE_API_KEY. */
    reportToEvalGate?: boolean;
    /** Evaluation ID (from config or arg). Required when reportToEvalGate is true. */
    evaluationId?: string;
    /** EvalGate API base URL. Default: EVALGATE_BASE_URL or http://localhost:3000 */
    baseUrl?: string;
    /** Idempotency key for import (e.g. CI run ID). Prevents duplicate runs on retry. */
    idempotencyKey?: string;
}
export interface OpenAIChatEvalResult {
    passed: number;
    total: number;
    score: number;
    results: TestSuiteCaseResult[];
    durationMs: number;
    /** Case IDs that were retried (flaky recovery) */
    retriedCases?: string[];
}
/**
 * Run OpenAI chat regression tests locally.
 * No EvalGate account required. Returns score and prints CI-friendly summary.
 */
export declare function openAIChatEval(options: OpenAIChatEvalOptions): Promise<OpenAIChatEvalResult>;
