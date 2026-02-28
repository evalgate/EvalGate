#!/usr/bin/env npx tsx
/**
 * RAG Evaluation — scores a RAG pipeline on answer relevance,
 * citation accuracy, and hallucination rate.
 *
 * Usage:
 *   npx tsx rag-eval.ts
 *   OPENAI_API_KEY=sk-... npx tsx rag-eval.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Types ──

interface GoldenCase {
	query: string;
	expectedCitations: string[];
	expectedPattern: string;
	category: string;
}

interface CaseResult {
	query: string;
	category: string;
	relevanceScore: number;
	citationScore: number;
	hallucinationScore: number;
	compositeScore: number;
	passed: boolean;
}

// ── Simulated RAG pipeline ──
// Replace this with your actual RAG pipeline call

function simulateRAGPipeline(query: string): {
	answer: string;
	citations: string[];
} {
	const responses: Record<string, { answer: string; citations: string[] }> = {
		"What is your refund policy?": {
			answer:
				"Our refund policy allows returns within 30 days of purchase. Items must be in original condition.",
			citations: ["policy-doc-001"],
		},
		"How do I reset my password?": {
			answer:
				'Go to Settings > Account > Password. Click "Reset Password" and follow the email instructions.',
			citations: ["support-doc-042"],
		},
		"What are your business hours?": {
			answer:
				"Our business hours are Monday through Friday, 9 AM to 5 PM Eastern Time.",
			citations: ["hours-doc-007"],
		},
	};

	return (
		responses[query] ?? {
			answer: "I don't have information about that topic.",
			citations: [],
		}
	);
}

// ── Scoring functions ──

function scoreRelevance(answer: string, pattern: string): number {
	const regex = new RegExp(pattern, "i");
	return regex.test(answer) ? 100 : 30;
}

function scoreCitations(actual: string[], expected: string[]): number {
	if (expected.length === 0) return 100;
	const hits = expected.filter((id) => actual.includes(id)).length;
	return Math.round((hits / expected.length) * 100);
}

function scoreHallucination(answer: string, citations: string[]): number {
	// Simple heuristic: penalize if answer is long but no citations
	if (answer.length > 50 && citations.length === 0) return 40;
	return 100;
}

// ── Main ──

function main(): void {
	const casesPath = resolve(__dirname, "golden-cases.json");
	const cases: GoldenCase[] = JSON.parse(readFileSync(casesPath, "utf-8"));

	console.log(`\n  RAG Evaluation — ${cases.length} golden cases\n`);

	const results: CaseResult[] = [];

	for (const c of cases) {
		const { answer, citations } = simulateRAGPipeline(c.query);

		const relevanceScore = scoreRelevance(answer, c.expectedPattern);
		const citationScore = scoreCitations(citations, c.expectedCitations);
		const hallucinationScore = scoreHallucination(answer, citations);

		// Weighted composite: relevance 40%, citation 30%, hallucination 30%
		const compositeScore = Math.round(
			relevanceScore * 0.4 + citationScore * 0.3 + hallucinationScore * 0.3,
		);

		const passed = compositeScore >= 70;

		results.push({
			query: c.query,
			category: c.category,
			relevanceScore,
			citationScore,
			hallucinationScore,
			compositeScore,
			passed,
		});

		const icon = passed ? "✔" : "✖";
		console.log(`  ${icon} [${c.category}] ${c.query} — ${compositeScore}/100`);
	}

	const avgScore = Math.round(
		results.reduce((sum, r) => sum + r.compositeScore, 0) / results.length,
	);
	const passCount = results.filter((r) => r.passed).length;

	console.log(
		`\n  Score: ${avgScore}/100  (${passCount}/${results.length} passed)\n`,
	);

	// Write results for gate consumption
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
