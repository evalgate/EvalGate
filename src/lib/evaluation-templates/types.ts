import type React from "react";

/**
 * Unified evaluation template interface used by both the "quick-start"
 * featured library and the full 39-template catalog.
 *
 * Fields marked optional are present in one system but not the other:
 *   - icon, type, judgePrompt, humanEvalCriteria → catalog templates
 *   - estimatedTime, rubric → featured library templates
 */
export interface EvaluationTemplate {
	id: string;
	name: string;
	description: string;
	category: string;
	complexity: "beginner" | "intermediate" | "advanced";
	testCases: Array<{
		input: string;
		expectedOutput?: string;
		rubric?: string;
		metadata?: Record<string, unknown>;
	}>;
	code?: string;
	icon?: React.ComponentType<{ className?: string }>;
	type?: "unit_test" | "human_eval" | "model_eval" | "ab_test";
	judgePrompt?: string;
	humanEvalCriteria?: Array<{
		name: string;
		description: string;
		scale: string;
	}>;
	estimatedTime?: string;
	rubric?: string;
}
