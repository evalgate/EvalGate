/**
 * openAIChatEval — One-function OpenAI chat regression testing
 *
 * Run local regression tests with OpenAI. No EvalAI account required.
 * CI-friendly output. Optional reportToEvalAI in v1.5.
 *
 * @example
 * ```typescript
 * import { openAIChatEval } from '@pauly4010/evalai-sdk';
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
import type { TestSuiteCaseResult } from '../testing';
export interface OpenAIChatEvalCase {
    input: string;
    expectedOutput?: string;
    /** Platform test case ID. When provided, used directly for reportToEvalAI (no input matching). */
    testCaseId?: number;
    assertions?: ((output: string) => import('../assertions').AssertionResult)[];
}
export interface OpenAIChatEvalOptions {
    name: string;
    model?: string;
    apiKey?: string;
    cases: OpenAIChatEvalCase[];
    /** v1.5: Upload results to EvalAI platform for an existing evaluation. Requires evaluationId and EVALAI_API_KEY. */
    reportToEvalAI?: boolean;
    /** Evaluation ID (from config or arg). Required when reportToEvalAI is true. */
    evaluationId?: string;
    /** EvalAI API base URL. Default: EVALAI_BASE_URL or http://localhost:3000 */
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
}
/**
 * Run OpenAI chat regression tests locally.
 * No EvalAI account required. Returns score and prints CI-friendly summary.
 */
export declare function openAIChatEval(options: OpenAIChatEvalOptions): Promise<OpenAIChatEvalResult>;
