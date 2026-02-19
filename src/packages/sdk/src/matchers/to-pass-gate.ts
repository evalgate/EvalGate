/**
 * Vitest/Jest matcher: expect(result).toPassGate()
 * Use with openAIChatEval: expect(await openAIChatEval(...)).toPassGate()
 *
 * @example
 * ```ts
 * import { openAIChatEval } from '@pauly4010/evalai-sdk';
 * import { expect } from 'vitest';
 * import { extendExpectWithToPassGate } from '@pauly4010/evalai-sdk/matchers';
 *
 * extendExpectWithToPassGate(expect);
 *
 * it('passes gate', async () => {
 *   const result = await openAIChatEval({ name: 'test', cases: [...] });
 *   expect(result).toPassGate();
 * });
 * ```
 */

import type { OpenAIChatEvalResult } from "../integrations/openai-eval";

export function toPassGate(
  this: { isNot?: boolean },
  received: OpenAIChatEvalResult,
): { pass: boolean; message: () => string } {
  const passed = received.passed === received.total && received.total > 0;
  const isNot = this.isNot ?? false;
  const success = isNot ? !passed : passed;

  const message = () =>
    isNot
      ? `Expected result not to pass gate (${received.passed}/${received.total} passed, score ${received.score})`
      : `Expected result to pass gate but ${received.passed}/${received.total} passed (score ${received.score})`;

  return { pass: success, message };
}

/** Register toPassGate matcher with expect. Call in test setup. */
export function extendExpectWithToPassGate(expect: { extend: (matchers: object) => void }): void {
  expect.extend({ toPassGate });
}
