"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAIChatEval = openAIChatEval;
const testing_1 = require("../testing");
const assertions_1 = require("../assertions");
const MAX_FAILED_CASES_TO_SHOW = 5;
function getOpenAI() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const OpenAI = require('openai');
        return OpenAI;
    }
    catch {
        throw new Error('openai package is required for openAIChatEval. Install with: npm install openai');
    }
}
function createExecutor(model, apiKey) {
    const OpenAI = getOpenAI();
    const openai = new OpenAI({ apiKey });
    return async (input) => {
        const response = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: input }],
            temperature: 0.1,
        });
        return response.choices[0]?.message?.content ?? '';
    };
}
function printSummary(result) {
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
        console.log('  npx evalai init');
    }
    else {
        console.log('Tip: Want dashboards and history?');
        console.log('Set EVALAI_API_KEY and connect this to the platform.');
    }
}
/**
 * Run OpenAI chat regression tests locally.
 * No EvalAI account required. Returns score and prints CI-friendly summary.
 */
async function openAIChatEval(options) {
    const { name, model = 'gpt-4o-mini', apiKey, cases } = options;
    const resolvedApiKey = apiKey ?? (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!resolvedApiKey) {
        throw new Error('OPENAI_API_KEY is required. Set it in the environment or pass apiKey to openAIChatEval.');
    }
    const executor = createExecutor(model, resolvedApiKey);
    const suiteCases = cases.map((c) => {
        const assertions = c.assertions
            ? [...c.assertions]
            : c.expectedOutput
                ? [(output) => (0, assertions_1.expect)(output).toContainKeywords(c.expectedOutput.split(/\s+/).filter(Boolean))]
                : undefined;
        return {
            input: c.input,
            expected: c.expectedOutput,
            assertions,
        };
    });
    const suite = (0, testing_1.createTestSuite)(name, {
        cases: suiteCases,
        executor,
        parallel: true,
    });
    const result = await suite.run();
    const score = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
    const evalResult = {
        passed: result.passed,
        total: result.total,
        score,
        results: result.results,
        durationMs: result.durationMs,
    };
    printSummary(evalResult);
    return evalResult;
}
