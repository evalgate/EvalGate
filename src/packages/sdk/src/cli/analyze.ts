import * as fs from "node:fs";
import * as path from "node:path";

export type AnalyzeFormat = "human" | "json";

export const DEFAULT_LABELED_DATASET_PATH = path.join(
	process.cwd(),
	".evalgate",
	"golden",
	"labeled.jsonl",
);

export interface AnalyzeOptions {
	datasetPath: string;
	format: AnalyzeFormat;
	top: number;
}

export type LabeledOutcome = "pass" | "fail";

export interface LabeledGoldenCase {
	caseId: string;
	input: string;
	expected: string;
	actual: string;
	label: LabeledOutcome;
	failureMode: string | null;
	labeledAt: string;
}

export interface FailureMode {
	mode: string;
	count: number;
	frequency: number;
}

export interface AnalyzeSummary {
	total: number;
	failed: number;
	passRate: number;
	failureModes: FailureMode[];
}

function isIsoTimestamp(value: string): boolean {
	return Number.isFinite(Date.parse(value));
}

export function parseLabeledDataset(content: string): LabeledGoldenCase[] {
	const rows = content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	return rows.map((line, i) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line) as unknown;
		} catch {
			throw new Error(
				`Invalid JSONL at line ${i + 1}: expected valid JSON object`,
			);
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error(
				`Invalid JSONL at line ${i + 1}: expected JSON object record`,
			);
		}

		const record = parsed as Record<string, unknown>;
		const caseId = record.caseId;
		const input = record.input;
		const expected = record.expected;
		const actual = record.actual;
		const label = record.label;
		const failureMode = record.failureMode;
		const labeledAt = record.labeledAt;

		if (typeof caseId !== "string" || caseId.trim().length === 0) {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: caseId must be a non-empty string`,
			);
		}
		if (typeof input !== "string") {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: input must be a string`,
			);
		}
		if (typeof expected !== "string") {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: expected must be a string`,
			);
		}
		if (typeof actual !== "string") {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: actual must be a string`,
			);
		}
		if (label !== "pass" && label !== "fail") {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: label must be "pass" or "fail"`,
			);
		}
		if (!(typeof failureMode === "string" || failureMode === null)) {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: failureMode must be string or null`,
			);
		}
		if (label === "fail" && (!failureMode || failureMode.trim().length === 0)) {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: failed rows require a non-empty failureMode`,
			);
		}
		if (
			label === "pass" &&
			typeof failureMode === "string" &&
			failureMode.trim().length > 0
		) {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: passing rows must set failureMode to null or empty string`,
			);
		}
		if (typeof labeledAt !== "string" || !isIsoTimestamp(labeledAt)) {
			throw new Error(
				`Invalid labeled dataset at line ${i + 1}: labeledAt must be an ISO timestamp string`,
			);
		}

		return {
			caseId,
			input,
			expected,
			actual,
			label,
			failureMode,
			labeledAt,
		};
	});
}

function classifyFailureMode(item: LabeledGoldenCase): string {
	if (item.failureMode && item.failureMode.trim().length > 0) {
		return item.failureMode.trim();
	}
	return "failed_without_mode";
}

export function analyzeLabeledDataset(
	rows: LabeledGoldenCase[],
	top: number,
): AnalyzeSummary {
	const total = rows.length;
	const failedItems = rows.filter((r) => r.label === "fail");
	const failed = failedItems.length;
	const passRate = total > 0 ? (total - failed) / total : 0;

	const counts = new Map<string, number>();
	for (const item of failedItems) {
		const mode = classifyFailureMode(item);
		counts.set(mode, (counts.get(mode) ?? 0) + 1);
	}

	const failureModes = [...counts.entries()]
		.map(([mode, count]) => ({
			mode,
			count,
			frequency: failed > 0 ? count / failed : 0,
		}))
		.sort((a, b) => b.count - a.count || a.mode.localeCompare(b.mode))
		.slice(0, Math.max(1, top));

	return { total, failed, passRate, failureModes };
}

export function formatAnalyzeHuman(summary: AnalyzeSummary): string {
	const lines: string[] = [];
	lines.push("Analyze phase (first pass)");
	lines.push(`Total cases: ${summary.total}`);
	lines.push(
		`Failed: ${summary.failed} (${(summary.total > 0 ? (summary.failed / summary.total) * 100 : 0).toFixed(1)}%)`,
	);
	lines.push(`Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);

	if (summary.failureModes.length === 0) {
		lines.push("Failure modes: none");
		return lines.join("\n");
	}

	lines.push("Top failure modes:");
	for (const [index, mode] of summary.failureModes.entries()) {
		lines.push(
			`${index + 1}. ${mode.mode} — ${mode.count} (${(mode.frequency * 100).toFixed(1)}%)`,
		);
	}
	return lines.join("\n");
}

function parseAnalyzeArgs(argv: string[]): AnalyzeOptions {
	const args: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith("--")) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next !== undefined && !next.startsWith("--")) {
			args[key] = next;
			i++;
		} else {
			args[key] = "true";
		}
	}

	const topRaw = parseInt(args.top ?? "5", 10);
	return {
		datasetPath: args.dataset || DEFAULT_LABELED_DATASET_PATH,
		format: args.format === "json" ? "json" : "human",
		top: Number.isNaN(topRaw) || topRaw < 1 ? 5 : topRaw,
	};
}

export function runAnalyze(argv: string[]): number {
	const options = parseAnalyzeArgs(argv);
	let rows: LabeledGoldenCase[];
	try {
		const raw = fs.readFileSync(options.datasetPath, "utf8");
		rows = parseLabeledDataset(raw);
	} catch (error) {
		console.error(
			`EvalGate analyze ERROR: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 2;
	}

	const summary = analyzeLabeledDataset(rows, options.top);
	if (options.format === "json") {
		console.log(JSON.stringify(summary));
	} else {
		console.log(formatAnalyzeHuman(summary));
	}
	return 0;
}
