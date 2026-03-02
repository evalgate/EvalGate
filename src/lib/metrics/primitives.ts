/**
 * Metric Primitives — built-in, composable metric functions for the DAG engine.
 *
 * Each primitive takes a `MetricContext` (access to trace data) and returns
 * a `PrimitiveResult` (0-1 score + optional metadata).
 *
 * Pure module — no DB or I/O dependencies.
 */

// ── Context ───────────────────────────────────────────────────────────────────

/** Data available to metric primitives during evaluation */
export interface MetricContext {
	/** The prompt / input to the agent */
	prompt: string;
	/** The agent's response */
	response: string;
	/** Expected output (for comparison-based metrics) */
	expectedOutput?: string;
	/** Latency in milliseconds */
	latencyMs?: number;
	/** Estimated cost in USD */
	costUsd?: number;
	/** Tool calls made during the response */
	toolCalls?: ToolCallRecord[];
	/** Custom key-value metadata from the trace */
	metadata?: Record<string, unknown>;
}

export interface ToolCallRecord {
	name: string;
	/** Whether the tool call succeeded */
	success: boolean;
	latencyMs?: number;
}

/** Result of a primitive metric evaluation */
export interface PrimitiveResult {
	/** Score in [0, 1] */
	score: number;
	/** Whether the metric passed its internal threshold */
	passed: boolean;
	/** Human-readable explanation */
	label: string;
	/** Raw values used for debugging */
	raw?: Record<string, unknown>;
}

/** A named primitive metric function */
export type PrimitiveFn = (
	context: MetricContext,
	options?: Record<string, unknown>,
) => PrimitiveResult;

// ── String matching ───────────────────────────────────────────────────────────

/**
 * Exact match: 1 if response === expected, 0 otherwise.
 * Case-insensitive by default.
 */
export const exactMatch: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const caseSensitive = Boolean(opts.caseSensitive);
	if (!ctx.expectedOutput) {
		return { score: 0, passed: false, label: "No expected output provided" };
	}
	const a = caseSensitive ? ctx.response : ctx.response.toLowerCase();
	const b = caseSensitive
		? ctx.expectedOutput
		: ctx.expectedOutput.toLowerCase();
	const passed = a.trim() === b.trim();
	return {
		score: passed ? 1 : 0,
		passed,
		label: passed ? "Exact match" : "Mismatch",
	};
};

/**
 * Contains: 1 if response contains expected string (or all expected tokens).
 */
export const containsMatch: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const caseSensitive = Boolean(opts.caseSensitive);
	if (!ctx.expectedOutput) {
		return { score: 0, passed: false, label: "No expected output provided" };
	}
	const text = caseSensitive ? ctx.response : ctx.response.toLowerCase();
	const needle = caseSensitive
		? ctx.expectedOutput
		: ctx.expectedOutput.toLowerCase();
	const passed = text.includes(needle);
	return {
		score: passed ? 1 : 0,
		passed,
		label: passed ? "Contains expected" : "Does not contain expected",
	};
};

/**
 * Regex match: 1 if response matches the pattern provided in options.pattern.
 */
export const regexMatch: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const pattern = opts.pattern;
	if (!pattern || typeof pattern !== "string") {
		return {
			score: 0,
			passed: false,
			label: "No regex pattern provided in options.pattern",
		};
	}
	const flags = typeof opts.flags === "string" ? opts.flags : "i";
	try {
		const re = new RegExp(pattern, flags);
		const passed = re.test(ctx.response);
		return {
			score: passed ? 1 : 0,
			passed,
			label: passed ? `Matches /${pattern}/` : `No match for /${pattern}/`,
		};
	} catch {
		return { score: 0, passed: false, label: `Invalid regex: ${pattern}` };
	}
};

// ── Token-level ───────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
}

/**
 * Token F1: harmonic mean of token-level precision and recall vs expected.
 * Common in QA benchmarks (SQuAD-style).
 */
export const tokenF1: PrimitiveFn = (ctx): PrimitiveResult => {
	if (!ctx.expectedOutput) {
		return { score: 0, passed: false, label: "No expected output" };
	}
	const predTokens = tokenize(ctx.response);
	const goldTokens = tokenize(ctx.expectedOutput);

	if (predTokens.length === 0 || goldTokens.length === 0) {
		return { score: 0, passed: false, label: "Empty token sequence" };
	}

	const predSet = new Map<string, number>();
	for (const t of predTokens) predSet.set(t, (predSet.get(t) ?? 0) + 1);

	let overlap = 0;
	const goldCounts = new Map<string, number>();
	for (const t of goldTokens) goldCounts.set(t, (goldCounts.get(t) ?? 0) + 1);
	for (const [t, count] of goldCounts) {
		overlap += Math.min(count, predSet.get(t) ?? 0);
	}

	if (overlap === 0) return { score: 0, passed: false, label: "Token F1: 0" };

	const precision = overlap / predTokens.length;
	const recall = overlap / goldTokens.length;
	const f1 = (2 * precision * recall) / (precision + recall);

	return {
		score: f1,
		passed: f1 >= 0.5,
		label: `Token F1: ${(f1 * 100).toFixed(0)}%`,
		raw: {
			precision,
			recall,
			overlap,
			predTokens: predTokens.length,
			goldTokens: goldTokens.length,
		},
	};
};

/**
 * Jaccard similarity between response and expected output tokens.
 */
export const jaccardSimilarity: PrimitiveFn = (ctx): PrimitiveResult => {
	if (!ctx.expectedOutput) {
		return { score: 0, passed: false, label: "No expected output" };
	}
	const a = new Set(tokenize(ctx.response));
	const b = new Set(tokenize(ctx.expectedOutput));
	if (a.size === 0 && b.size === 0)
		return { score: 1, passed: true, label: "Both empty" };
	if (a.size === 0 || b.size === 0)
		return { score: 0, passed: false, label: "One empty" };

	let intersection = 0;
	for (const t of a) {
		if (b.has(t)) intersection++;
	}
	const score = intersection / (a.size + b.size - intersection);
	return {
		score,
		passed: score >= 0.3,
		label: `Jaccard: ${(score * 100).toFixed(0)}%`,
		raw: { intersection, unionSize: a.size + b.size - intersection },
	};
};

// ── Length constraints ────────────────────────────────────────────────────────

/**
 * Length ratio: scores response length relative to expected.
 * Score is 1 when lengths are equal, degrades linearly with deviation.
 */
export const lengthRatio: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const minRatio = typeof opts.minRatio === "number" ? opts.minRatio : 0.5;
	const maxRatio = typeof opts.maxRatio === "number" ? opts.maxRatio : 2.0;
	const expectedLen = ctx.expectedOutput?.length ?? 0;
	const actualLen = ctx.response.length;

	if (expectedLen === 0) {
		const withinMax =
			actualLen <= (typeof opts.maxChars === "number" ? opts.maxChars : 2000);
		return {
			score: withinMax ? 1 : 0.5,
			passed: withinMax,
			label: `Length: ${actualLen} chars`,
		};
	}

	const ratio = actualLen / expectedLen;
	const passed = ratio >= minRatio && ratio <= maxRatio;
	const score = passed ? 1 : Math.max(0, 1 - Math.abs(1 - ratio));

	return {
		score,
		passed,
		label: `Length ratio: ${ratio.toFixed(2)} (${actualLen}/${expectedLen})`,
		raw: { ratio, actualLen, expectedLen },
	};
};

/**
 * Max length: 1 if response is within maxChars, 0 otherwise.
 */
export const maxLength: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const limit = typeof opts.maxChars === "number" ? opts.maxChars : 500;
	const len = ctx.response.length;
	const passed = len <= limit;
	return {
		score: passed ? 1 : Math.max(0, 1 - (len - limit) / limit),
		passed,
		label: `${len}/${limit} chars`,
		raw: { len, limit },
	};
};

// ── Performance ───────────────────────────────────────────────────────────────

/**
 * Latency score: 1 at or below target, degrades linearly, 0 at 2× target.
 */
export const latencyScore: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const targetMs = typeof opts.targetMs === "number" ? opts.targetMs : 2000;
	const latency = ctx.latencyMs;

	if (latency === undefined) {
		return { score: 0.5, passed: true, label: "Latency not recorded" };
	}

	const score =
		latency <= targetMs ? 1 : Math.max(0, 1 - (latency - targetMs) / targetMs);
	const passed = latency <= targetMs * 1.5;

	return {
		score,
		passed,
		label: `${latency}ms (target: ${targetMs}ms)`,
		raw: { latencyMs: latency, targetMs },
	};
};

/**
 * Cost score: 1 at or below budget, degrades linearly, 0 at 2× budget.
 */
export const costScore: PrimitiveFn = (ctx, opts = {}): PrimitiveResult => {
	const budgetUsd = typeof opts.budgetUsd === "number" ? opts.budgetUsd : 0.01;
	const cost = ctx.costUsd;

	if (cost === undefined) {
		return { score: 0.5, passed: true, label: "Cost not recorded" };
	}

	const score =
		cost <= budgetUsd ? 1 : Math.max(0, 1 - (cost - budgetUsd) / budgetUsd);
	const passed = cost <= budgetUsd * 1.5;

	return {
		score,
		passed,
		label: `$${cost.toFixed(4)} (budget: $${budgetUsd.toFixed(4)})`,
		raw: { costUsd: cost, budgetUsd },
	};
};

// ── Tool use ──────────────────────────────────────────────────────────────────

/**
 * Tool success rate: ratio of successful tool calls.
 */
export const toolSuccessRate: PrimitiveFn = (ctx): PrimitiveResult => {
	const tools = ctx.toolCalls ?? [];
	if (tools.length === 0) {
		return { score: 1, passed: true, label: "No tool calls" };
	}
	const successCount = tools.filter((t) => t.success).length;
	const score = successCount / tools.length;
	return {
		score,
		passed: score >= 0.8,
		label: `${successCount}/${tools.length} tools succeeded`,
		raw: { successCount, totalCalls: tools.length },
	};
};

/**
 * Required tool used: 1 if a specific tool was called, 0 otherwise.
 */
export const requiredToolUsed: PrimitiveFn = (
	ctx,
	opts = {},
): PrimitiveResult => {
	const toolName = opts.toolName;
	if (typeof toolName !== "string") {
		return { score: 0, passed: false, label: "options.toolName is required" };
	}
	const tools = ctx.toolCalls ?? [];
	const used = tools.some((t) => t.name === toolName);
	return {
		score: used ? 1 : 0,
		passed: used,
		label: used ? `Tool "${toolName}" used` : `Tool "${toolName}" not used`,
	};
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const PRIMITIVE_REGISTRY: Record<string, PrimitiveFn> = {
	exact_match: exactMatch,
	contains_match: containsMatch,
	regex_match: regexMatch,
	token_f1: tokenF1,
	jaccard_similarity: jaccardSimilarity,
	length_ratio: lengthRatio,
	max_length: maxLength,
	latency_score: latencyScore,
	cost_score: costScore,
	tool_success_rate: toolSuccessRate,
	required_tool_used: requiredToolUsed,
};

/**
 * Look up a primitive by name, returning undefined if not found.
 */
export function getPrimitive(name: string): PrimitiveFn | undefined {
	return PRIMITIVE_REGISTRY[name];
}
