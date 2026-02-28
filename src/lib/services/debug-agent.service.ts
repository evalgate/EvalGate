// src/lib/services/debug-agent.service.ts

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluationRuns, llmJudgeResults, testResults } from "@/db/schema";
import { logger } from "@/lib/logger";

interface TestResultData {
	id: number;
	actualOutput?: string;
	output?: string;
}

interface JudgeResultData {
	testResultId: number;
	reasoning?: string;
}

export interface DebugAnalysis {
	runId: number;
	summary: string;
	failurePatterns: FailurePattern[];
	suggestedFixes: SuggestedFix[];
	rootCauses: string[];
	severity: "low" | "medium" | "high" | "critical";
}

export interface FailurePattern {
	pattern: string;
	occurrences: number;
	affectedTestIds: number[];
	category:
		| "hallucination"
		| "refusal"
		| "off_topic"
		| "formatting"
		| "incomplete"
		| "other";
}

export interface SuggestedFix {
	type: "prompt_edit" | "parameter_change" | "model_switch" | "data_fix";
	description: string;
	confidence: number;
	diff?: { before: string; after: string };
}

/**
 * Debug Agent Service — AI-powered failure analysis.
 * Analyzes failed evaluation runs, identifies patterns,
 * and suggests prompt fixes (the "A2UI Debugging" viral feature).
 */
class DebugAgentService {
	/**
	 * Analyze a failed evaluation run and produce debugging insights.
	 */
	async analyze(
		evaluationId: number,
		runId: number,
		_organizationId: number,
	): Promise<DebugAnalysis> {
		logger.info("Debug agent analyzing run", { evaluationId, runId });

		// 1. Fetch the run
		const [run] = await db
			.select()
			.from(evaluationRuns)
			.where(
				and(
					eq(evaluationRuns.id, runId),
					eq(evaluationRuns.evaluationId, evaluationId),
				),
			)
			.limit(1);

		if (!run) throw new Error("Evaluation run not found");

		// 2. Fetch all test results for this run
		const results = await db
			.select()
			.from(testResults)
			.where(eq(testResults.evaluationRunId, runId));

		// 3. Fetch judge results if available
		const judgeResults = await db
			.select()
			.from(llmJudgeResults)
			.where(eq(llmJudgeResults.evaluationRunId, runId));

		// 4. Identify failure patterns
		const failedResults = results.filter(
			(r) => r.status === "failed" || (r.score !== null && r.score < 50),
		);
		const failurePatterns = this.identifyPatterns(failedResults, judgeResults);

		// 5. Determine root causes
		const rootCauses = this.determineRootCauses(failurePatterns, failedResults);

		// 6. Generate suggested fixes
		const suggestedFixes = this.generateFixes(failurePatterns, rootCauses);

		// 7. Calculate severity
		const failureRate =
			results.length > 0 ? failedResults.length / results.length : 0;
		const severity =
			failureRate > 0.5
				? "critical"
				: failureRate > 0.3
					? "high"
					: failureRate > 0.1
						? "medium"
						: "low";

		// 8. Build summary
		const summary = this.buildSummary(
			results.length,
			failedResults.length,
			failurePatterns,
			severity,
		);

		return {
			runId,
			summary,
			failurePatterns,
			suggestedFixes,
			rootCauses,
			severity,
		};
	}

	/**
	 * Identify failure patterns from test results.
	 */
	private identifyPatterns(
		failedResults: unknown[],
		judgeResults: unknown[],
	): FailurePattern[] {
		const patterns: Map<string, FailurePattern> = new Map();

		for (const result of failedResults) {
			const category = this.categorizeFailure(
				result as TestResultData,
				judgeResults as JudgeResultData[],
			);
			const key = category;

			if (!patterns.has(key)) {
				patterns.set(key, {
					pattern: this.getPatternDescription(category),
					occurrences: 0,
					affectedTestIds: [],
					category,
				});
			}

			const pattern = patterns.get(key);
			if (!pattern) continue;
			pattern.occurrences++;
			pattern.affectedTestIds.push((result as any).id);
		}

		return Array.from(patterns.values()).sort(
			(a, b) => b.occurrences - a.occurrences,
		);
	}

	/**
	 * Categorize a failure based on result content.
	 */
	private categorizeFailure(
		result: TestResultData,
		judgeResults: JudgeResultData[],
	): FailurePattern["category"] {
		const output = (result.actualOutput || result.output || "").toLowerCase();
		const judgeResult = judgeResults.find(
			(jr) => jr.testResultId === result.id,
		);
		const reasoning = (judgeResult?.reasoning || "").toLowerCase();

		if (reasoning.includes("hallucin") || output.includes("i cannot verify"))
			return "hallucination";
		if (
			reasoning.includes("refus") ||
			output.includes("i can't") ||
			output.includes("i cannot")
		)
			return "refusal";
		if (reasoning.includes("off.topic") || reasoning.includes("irrelevant"))
			return "off_topic";
		if (reasoning.includes("format") || reasoning.includes("structure"))
			return "formatting";
		if (
			reasoning.includes("incomplete") ||
			reasoning.includes("truncat") ||
			output.length < 20
		)
			return "incomplete";
		return "other";
	}

	private getPatternDescription(category: FailurePattern["category"]): string {
		const descriptions: Record<string, string> = {
			hallucination:
				"Model generated factually incorrect or unverifiable information",
			refusal:
				"Model refused to answer or expressed inability to complete the task",
			off_topic: "Model response was not relevant to the input prompt",
			formatting: "Response did not follow the expected output format",
			incomplete: "Response was truncated or missing required information",
			other: "Failure did not match a known pattern",
		};
		return descriptions[category] || descriptions.other;
	}

	/**
	 * Determine root causes from failure patterns.
	 */
	private determineRootCauses(
		patterns: FailurePattern[],
		failedResults: unknown[],
	): string[] {
		const causes: string[] = [];

		const dominant = patterns[0];
		if (!dominant) return ["No failures detected"];

		if (dominant.category === "hallucination") {
			causes.push("Prompt may lack grounding context or source material");
			causes.push(
				'Consider adding "Only use the provided context" instruction',
			);
		}
		if (dominant.category === "refusal") {
			causes.push("Prompt may trigger safety filters");
			causes.push("Try rephrasing sensitive topics or adding context");
		}
		if (dominant.category === "off_topic") {
			causes.push("Prompt instructions may be ambiguous");
			causes.push("Add explicit task description and output expectations");
		}
		if (dominant.category === "formatting") {
			causes.push("Output format specification may be unclear");
			causes.push("Add few-shot examples of the expected format");
		}
		if (dominant.category === "incomplete") {
			causes.push("Max token limit may be too low");
			causes.push("Task may be too complex for a single prompt");
		}

		if (failedResults.length > 10) {
			causes.push(
				"High failure count suggests a systemic prompt issue rather than edge cases",
			);
		}

		return causes;
	}

	/**
	 * Generate suggested fixes based on analysis.
	 */
	private generateFixes(
		patterns: FailurePattern[],
		_rootCauses: string[],
	): SuggestedFix[] {
		const fixes: SuggestedFix[] = [];

		for (const pattern of patterns.slice(0, 3)) {
			if (pattern.category === "hallucination") {
				fixes.push({
					type: "prompt_edit",
					description:
						'Add grounding instruction: "Only use information from the provided context. If unsure, say so."',
					confidence: 0.8,
					diff: {
						before: "{{system_prompt}}",
						after:
							"{{system_prompt}}\n\nIMPORTANT: Only use information from the provided context. If you are unsure, explicitly state that.",
					},
				});
			}
			if (pattern.category === "formatting") {
				fixes.push({
					type: "prompt_edit",
					description: "Add explicit output format with an example",
					confidence: 0.75,
				});
			}
			if (pattern.category === "incomplete") {
				fixes.push({
					type: "parameter_change",
					description: "Increase max_tokens from 1024 to 2048",
					confidence: 0.7,
				});
			}
			if (pattern.category === "refusal") {
				fixes.push({
					type: "prompt_edit",
					description:
						'Add context framing: "This is for evaluation purposes in a controlled environment."',
					confidence: 0.6,
				});
			}
		}

		if (fixes.length === 0) {
			fixes.push({
				type: "model_switch",
				description:
					"Try a more capable model (e.g., GPT-4o or Claude 3.5 Sonnet)",
				confidence: 0.5,
			});
		}

		return fixes.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * Build a human-readable summary of the debug analysis.
	 */
	private buildSummary(
		totalTests: number,
		failedTests: number,
		patterns: FailurePattern[],
		severity: string,
	): string {
		const pct =
			totalTests > 0 ? Math.round((failedTests / totalTests) * 100) : 0;
		const topPattern = patterns[0];
		let summary = `${failedTests}/${totalTests} tests failed (${pct}%). Severity: ${severity}.`;

		if (topPattern) {
			summary += ` Primary failure: ${topPattern.category} (${topPattern.occurrences} occurrences).`;
		}

		return summary;
	}
}

export const debugAgentService = new DebugAgentService();
