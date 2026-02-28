#!/usr/bin/env npx tsx
/**
 * Code Generation Evaluation — scores a code generation system on
 * syntax validity, correctness (assertion passing), and style.
 *
 * Usage:
 *   npx tsx codegen-eval.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Types ──

interface Assertion {
	input: unknown[];
	expected: unknown;
}

interface GoldenCase {
	intent: string;
	expectedSignature: string;
	assertions: Assertion[];
}

interface CaseResult {
	intent: string;
	syntaxValid: boolean;
	assertionsPassed: number;
	assertionsTotal: number;
	antiPatterns: string[];
	compositeScore: number;
	passed: boolean;
}

// ── Simulated codegen ──
// Replace with your actual LLM call (e.g., OpenAI function calling)

function simulateCodegen(intent: string): string {
	const implementations: Record<string, string> = {
		"Write a function that reverses a string": `
function reverseString(s) {
  return s.split('').reverse().join('');
}`,
		"Write a function that checks if a number is prime": `
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}`,
		"Write a function that flattens a nested array": `
function flatten(arr) {
  return arr.reduce((acc, val) =>
    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
}`,
	};

	return implementations[intent] ?? `function unknown() { return null; }`;
}

// ── Scoring ──

function checkSyntax(code: string): boolean {
	try {
		new Function(code);
		return true;
	} catch {
		return false;
	}
}

function runAssertions(
	code: string,
	fnName: string,
	assertions: Assertion[],
): { passed: number; total: number } {
	let passed = 0;
	const total = assertions.length;

	for (const assertion of assertions) {
		try {
			const fn = new Function(
				`${code}\nreturn ${fnName}(${assertion.input.map((a) => JSON.stringify(a)).join(", ")});`,
			);
			const result = fn();
			if (JSON.stringify(result) === JSON.stringify(assertion.expected)) {
				passed++;
			}
		} catch {
			// assertion failed
		}
	}

	return { passed, total };
}

const ANTI_PATTERNS = [
	{ pattern: /\beval\s*\(/, name: "eval()" },
	{ pattern: /\bvar\s+/, name: "var keyword" },
	{ pattern: /==(?!=)/, name: "loose equality (==)" },
	{ pattern: /document\.write/, name: "document.write" },
];

function findAntiPatterns(code: string): string[] {
	return ANTI_PATTERNS.filter((ap) => ap.pattern.test(code)).map(
		(ap) => ap.name,
	);
}

// ── Main ──

function main(): void {
	const casesPath = resolve(__dirname, "golden-cases.json");
	const cases: GoldenCase[] = JSON.parse(readFileSync(casesPath, "utf-8"));

	console.log(`\n  Codegen Evaluation — ${cases.length} golden cases\n`);

	const results: CaseResult[] = [];

	for (const c of cases) {
		const code = simulateCodegen(c.intent);
		const fnName = c.expectedSignature.replace(/\(.*/, "");

		const syntaxValid = checkSyntax(code);
		const { passed: assertionsPassed, total: assertionsTotal } = syntaxValid
			? runAssertions(code, fnName, c.assertions)
			: { passed: 0, total: c.assertions.length };
		const antiPatterns = findAntiPatterns(code);

		// Weighted: syntax 30%, correctness 50%, style 20%
		const syntaxScore = syntaxValid ? 100 : 0;
		const correctnessScore =
			assertionsTotal > 0
				? Math.round((assertionsPassed / assertionsTotal) * 100)
				: 0;
		const styleScore = Math.max(0, 100 - antiPatterns.length * 25);

		const compositeScore = Math.round(
			syntaxScore * 0.3 + correctnessScore * 0.5 + styleScore * 0.2,
		);

		const passed = compositeScore >= 70;

		results.push({
			intent: c.intent,
			syntaxValid,
			assertionsPassed,
			assertionsTotal,
			antiPatterns,
			compositeScore,
			passed,
		});

		const icon = passed ? "✔" : "✖";
		console.log(
			`  ${icon} ${c.intent.slice(0, 50)}… — ${compositeScore}/100 (${assertionsPassed}/${assertionsTotal} assertions)`,
		);
	}

	const avgScore = Math.round(
		results.reduce((sum, r) => sum + r.compositeScore, 0) / results.length,
	);
	const passCount = results.filter((r) => r.passed).length;

	console.log(
		`\n  Score: ${avgScore}/100  (${passCount}/${results.length} passed)\n`,
	);

	// Write results
	const evalsDir = resolve(__dirname, "evals");
	if (!existsSync(evalsDir)) mkdirSync(evalsDir, { recursive: true });

	const report = {
		schemaVersion: 1,
		timestamp: new Date().toISOString(),
		score: avgScore,
		passRate: Math.round((passCount / results.length) * 100),
		totalCases: results.length,
		passedCases: passCount,
		results,
	};

	writeFileSync(
		resolve(evalsDir, "eval-results.json"),
		`${JSON.stringify(report, null, 2)}\n`,
	);
	console.log("  Wrote evals/eval-results.json\n");

	// Exit code contract: 0 = all cases passed, 1 = at least one failure
	process.exit(passCount === results.length ? 0 : 1);
}

main();
