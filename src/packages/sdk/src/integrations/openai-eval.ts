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

import { createTestSuite } from '../testing';
import { expect } from '../assertions';
import type { TestSuiteCaseResult } from '../testing';
import { loadConfig } from '../cli/config';
import { sha256Input } from '../utils/input-hash';

const MAX_FAILED_CASES_TO_SHOW = 5;

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

function getOpenAI(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const OpenAI = require('openai');
    return OpenAI;
  } catch {
    throw new Error(
      'openai package is required for openAIChatEval. Install with: npm install openai'
    );
  }
}

function createExecutor(model: string, apiKey: string): (input: string) => Promise<string> {
  const OpenAI = getOpenAI();
  const openai = new OpenAI({ apiKey });

  return async (input: string): Promise<string> => {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user' as const, content: input }],
      temperature: 0.1,
    });
    return response.choices[0]?.message?.content ?? '';
  };
}

function printSummary(result: OpenAIChatEvalResult): void {
  const { passed, total, results } = result;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failed = results.filter((r) => !r.passed);

  const status = failed.length === 0 ? 'PASS' : 'FAIL';
  console.log(`\n${status} ${passed}/${total}  (score: ${score})\n`);

  if (failed.length > 0) {
    const toShow = failed.slice(0, MAX_FAILED_CASES_TO_SHOW);
    const more = failed.length - toShow.length;
    console.log(`${failed.length} failing case${failed.length === 1 ? '' : 's'}:`);
    for (const r of toShow) {
      const expected = r.expected ?? '(no expected)';
      console.log(`- "${r.input}" → expected: ${expected}`);
    }
    if (more > 0) {
      console.log(`+ ${more} more`);
    }
    console.log('\nGate this in CI:');
    console.log('  npx -y @pauly4010/evalai-sdk@^1 init');
  } else {
    console.log('Tip: Want dashboards and history?');
    console.log('Set EVALAI_API_KEY and connect this to the platform.');
  }
}

/**
 * Run OpenAI chat regression tests locally.
 * No EvalAI account required. Returns score and prints CI-friendly summary.
 */
export async function openAIChatEval(
  options: OpenAIChatEvalOptions
): Promise<OpenAIChatEvalResult> {
  const { name, model = 'gpt-4o-mini', apiKey, cases } = options;

  const resolvedApiKey =
    apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
  if (!resolvedApiKey) {
    throw new Error(
      'OPENAI_API_KEY is required. Set it in the environment or pass apiKey to openAIChatEval.'
    );
  }

  const executor = createExecutor(model, resolvedApiKey);

  const suiteCases = cases.map((c) => {
    const assertions = c.assertions
      ? [...c.assertions]
      : c.expectedOutput
        ? [(output: string) => expect(output).toContainKeywords(c.expectedOutput!.split(/\s+/).filter(Boolean))]
        : undefined;
    return {
      input: c.input,
      expected: c.expectedOutput,
      assertions,
    };
  });

  const suite = createTestSuite(name, {
    cases: suiteCases,
    executor,
    parallel: true,
  });

  const result = await suite.run();

  const score = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
  const evalResult: OpenAIChatEvalResult = {
    passed: result.passed,
    total: result.total,
    score,
    results: result.results,
    durationMs: result.durationMs,
  };

  printSummary(evalResult);

  // v1.5: Optional report to EvalAI platform
  if (options.reportToEvalAI) {
    const config = typeof process !== 'undefined' && process.cwd ? loadConfig(process.cwd()) : null;
    const evalId = options.evaluationId || config?.evaluationId;
    if (!evalId || String(evalId).trim() === '') {
      console.log('Run evalai init and set evaluationId to upload results.');
      return evalResult;
    }
    const evalaiKey =
      (typeof process !== 'undefined' && process.env?.EVALAI_API_KEY) || '';
    if (!evalaiKey) {
      console.log('Set EVALAI_API_KEY to upload results.');
      return evalResult;
    }
    const baseUrl =
      options.baseUrl ||
      config?.baseUrl ||
      (typeof process !== 'undefined' && process.env?.EVALAI_BASE_URL) ||
      'http://localhost:3000';
    const url = String(baseUrl).replace(/\/$/, '');

    try {
      // Resolve testCaseId for each result: explicit testCaseId in cases, or match by inputHash
      const importResults: Array<{ testCaseId: number; status: 'passed' | 'failed'; output: string; latencyMs?: number }> = [];

      const hasExplicitIds = cases.some((c) => c.testCaseId != null);
      if (hasExplicitIds) {
        // Use testCaseId from cases (same order as results)
        for (let i = 0; i < result.results.length; i++) {
          const tcId = cases[i]?.testCaseId;
          if (tcId == null) {
            console.log('reportToEvalAI: All cases must have testCaseId when any has it.');
            return evalResult;
          }
          importResults.push({
            testCaseId: tcId,
            status: result.results[i].passed ? 'passed' : 'failed',
            output: result.results[i].actual ?? '',
            latencyMs: result.results[i].durationMs,
          });
        }
      } else {
        // Match by inputHash (same canonicalization as platform)
        const tcRes = await fetch(`${url}/api/evaluations/${evalId}/test-cases?limit=500`, {
          headers: { Authorization: `Bearer ${evalaiKey}` },
        });
        if (!tcRes.ok) {
          console.log('Could not fetch test cases. Check evaluationId and EVALAI_API_KEY.');
          return evalResult;
        }
        const platformCases = (await tcRes.json()) as Array<{ id: number; input: string }>;
        const hashToIds = new Map<string, number[]>();
        for (const tc of platformCases) {
          const input = tc.input ?? '';
          if (!input.trim()) continue;
          const hash = sha256Input(input);
          const existing = hashToIds.get(hash) ?? [];
          existing.push(tc.id);
          hashToIds.set(hash, existing);
        }

        for (const r of result.results) {
          const hash = sha256Input(r.input ?? '');
          const ids = hashToIds.get(hash);
          if (ids == null || ids.length === 0) {
            console.log(`No platform test case matches input: "${(r.input ?? '').slice(0, 50)}…"`);
            return evalResult;
          }
          if (ids.length > 1) {
            console.log(`Multiple platform test cases share the same input (hash collision). Use testCaseId in cases.`);
            return evalResult;
          }
          importResults.push({
            testCaseId: ids[0],
            status: r.passed ? 'passed' : 'failed',
            output: r.actual ?? '',
            latencyMs: r.durationMs,
          });
        }
      }

      if (importResults.length !== result.results.length) {
        console.log('Could not match all results to platform test cases.');
        return evalResult;
      }

      const sdkVersion = '1.4.1';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${evalaiKey}`,
      };
      if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }
      const importRes = await fetch(`${url}/api/evaluations/${evalId}/runs/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          environment: 'dev',
          results: importResults,
          importClientVersion: sdkVersion,
        }),
      });

      if (!importRes.ok) {
        const body = await importRes.text();
        console.log(`Upload failed: ${importRes.status} — ${body}`);
        return evalResult;
      }

      const importData = (await importRes.json()) as { dashboardUrl?: string };
      if (importData.dashboardUrl) {
        console.log(`Dashboard: ${importData.dashboardUrl}`);
      }
    } catch (err) {
      console.log('Upload failed:', err instanceof Error ? err.message : String(err));
    }
  }

  return evalResult;
}
