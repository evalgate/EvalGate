import * as fs from "node:fs";
import * as path from "node:path";

import {
	DEFAULT_LABELED_DATASET_PATH,
	type LabeledGoldenCase,
	parseLabeledDataset,
} from "./analyze";

export type SynthesizeFormat = "human" | "json";

export const DEFAULT_SYNTHETIC_DATASET_PATH = path.join(
	process.cwd(),
	".evalgate",
	"golden",
	"synthetic.jsonl",
);

export interface SynthesizeOptions {
	datasetPath: string;
	dimensionsPath: string | null;
	outputPath: string;
	format: SynthesizeFormat;
	count: number | null;
	failureModes: string[];
}

export interface SyntheticGoldenCase extends LabeledGoldenCase {
	synthetic: true;
	synthesizedAt: string;
	sourceCaseIds: string[];
	dimensions: Record<string, string>;
}

export interface SynthesizeSummary {
	sourceCases: number;
	sourceFailures: number;
	selectedFailureModes: string[];
	dimensionNames: string[];
	dimensionCombinationCount: number;
	generated: number;
	modeCounts: Array<{
		failureMode: string;
		count: number;
	}>;
	outputPath: string;
	cases: SyntheticGoldenCase[];
}

export interface DimensionMatrix {
	dimensions: Record<string, string[]>;
}

export function parseSynthesizeArgs(argv: string[]): SynthesizeOptions {
	const failureModes: string[] = [];
	const result: SynthesizeOptions = {
		datasetPath: DEFAULT_LABELED_DATASET_PATH,
		dimensionsPath: null,
		outputPath: DEFAULT_SYNTHETIC_DATASET_PATH,
		format: "human",
		count: null,
		failureModes,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if ((arg === "--dataset" || arg === "--input") && argv[i + 1]) {
			result.datasetPath = argv[++i];
		} else if (arg === "--dimensions" && argv[i + 1]) {
			result.dimensionsPath = argv[++i];
		} else if (arg === "--output" && argv[i + 1]) {
			result.outputPath = argv[++i];
		} else if (arg === "--format" && argv[i + 1]) {
			const format = argv[++i];
			if (format === "human" || format === "json") {
				result.format = format;
			}
		} else if (arg === "--count" && argv[i + 1]) {
			const parsed = Number.parseInt(argv[++i], 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				result.count = parsed;
			}
		} else if ((arg === "--failure-mode" || arg === "--mode") && argv[i + 1]) {
			const next = argv[++i];
			for (const mode of next.split(",")) {
				const normalized = mode.trim();
				if (normalized.length > 0) {
					failureModes.push(normalized);
				}
			}
		}
	}

	return result;
}

export function parseDimensionMatrix(content: string): DimensionMatrix {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content) as unknown;
	} catch {
		throw new Error("Dimension matrix must be valid JSON");
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Dimension matrix must be a JSON object");
	}

	const candidate = parsed as Record<string, unknown>;
	const rawDimensions =
		candidate.dimensions &&
		typeof candidate.dimensions === "object" &&
		!Array.isArray(candidate.dimensions)
			? (candidate.dimensions as Record<string, unknown>)
			: candidate;

	const dimensions: Record<string, string[]> = {};
	for (const [name, values] of Object.entries(rawDimensions)) {
		if (!Array.isArray(values)) {
			throw new Error(`Dimension '${name}' must be an array of strings`);
		}
		const normalized = values
			.map((value) => {
				if (typeof value !== "string") {
					throw new Error(`Dimension '${name}' must contain only strings`);
				}
				return value.trim();
			})
			.filter((value) => value.length > 0);
		if (normalized.length === 0) {
			throw new Error(`Dimension '${name}' must contain at least one value`);
		}
		dimensions[name] = normalized;
	}

	return { dimensions };
}

function cartesianDimensions(
	dimensions: Record<string, string[]>,
): Array<Record<string, string>> {
	const entries = Object.entries(dimensions);
	if (entries.length === 0) {
		return [{}];
	}

	let combinations: Array<Record<string, string>> = [{}];
	for (const [name, values] of entries) {
		const next: Array<Record<string, string>> = [];
		for (const combination of combinations) {
			for (const value of values) {
				next.push({
					...combination,
					[name]: value,
				});
			}
		}
		combinations = next;
	}

	return combinations;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function dimensionLabel(dimensions: Record<string, string>): string {
	const pairs = Object.entries(dimensions).map(
		([name, value]) => `${name}=${value}`,
	);
	return pairs.length > 0 ? pairs.join(", ") : "base";
}

function buildSyntheticCase(
	prototype: LabeledGoldenCase,
	failureMode: string,
	dimensions: Record<string, string>,
	sequence: number,
): SyntheticGoldenCase {
	const timestamp = new Date().toISOString();
	const dimsText = dimensionLabel(dimensions);
	const dimensionSuffix = slugify(dimsText) || "base";
	const modeSuffix = slugify(failureMode) || "failure-mode";

	return {
		caseId: `synthetic-${modeSuffix}-${dimensionSuffix}-${String(sequence + 1).padStart(3, "0")}`,
		input: [
			prototype.input.trim(),
			dimsText === "base" ? "" : `Synthetic dimensions: ${dimsText}`,
		]
			.filter((value) => value.length > 0)
			.join("\n"),
		expected: [
			prototype.expected.trim(),
			dimsText === "base" ? "" : `Target dimensions: ${dimsText}`,
		]
			.filter((value) => value.length > 0)
			.join("\n"),
		actual: [
			`Representative ${failureMode} failure draft.`,
			dimsText === "base" ? "" : `Scenario dimensions: ${dimsText}`,
			prototype.actual.trim(),
		]
			.filter((value) => value.length > 0)
			.join("\n"),
		label: "fail",
		failureMode,
		labeledAt: timestamp,
		synthetic: true,
		synthesizedAt: timestamp,
		sourceCaseIds: [prototype.caseId],
		dimensions,
	};
}

export function synthesizeLabeledDataset(
	rows: LabeledGoldenCase[],
	options: {
		dimensions?: Record<string, string[]>;
		count?: number | null;
		failureModes?: string[];
		outputPath?: string;
	} = {},
): SynthesizeSummary {
	const failedRows = rows.filter(
		(row) =>
			row.label === "fail" &&
			typeof row.failureMode === "string" &&
			row.failureMode.trim().length > 0,
	);
	const grouped = new Map<string, LabeledGoldenCase[]>();
	for (const row of failedRows) {
		const failureMode = row.failureMode!.trim();
		const current = grouped.get(failureMode) ?? [];
		current.push(row);
		grouped.set(failureMode, current);
	}

	const requestedModes = (options.failureModes ?? [])
		.map((mode) => mode.trim())
		.filter((mode) => mode.length > 0);
	const selectedFailureModes =
		requestedModes.length > 0
			? requestedModes.filter((mode) => grouped.has(mode))
			: [...grouped.entries()]
					.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
					.map(([mode]) => mode);

	const dimensionMatrix = options.dimensions ?? {};
	const combinations = cartesianDimensions(dimensionMatrix);
	const dimensionNames = Object.keys(dimensionMatrix);
	const plan: Array<{
		failureMode: string;
		dimensions: Record<string, string>;
	}> = [];
	for (const failureMode of selectedFailureModes) {
		for (const dimensions of combinations) {
			plan.push({ failureMode, dimensions });
		}
	}

	const targetCount =
		options.count ??
		(plan.length > 0
			? plan.length
			: selectedFailureModes.length > 0
				? selectedFailureModes.length
				: 0);
	const syntheticCases: SyntheticGoldenCase[] = [];
	if (targetCount > 0 && plan.length > 0) {
		for (let i = 0; i < targetCount; i++) {
			const step = plan[i % plan.length]!;
			const sourceRows = grouped.get(step.failureMode)!;
			const prototype =
				sourceRows[Math.floor(i / plan.length) % sourceRows.length]!;
			syntheticCases.push(
				buildSyntheticCase(prototype, step.failureMode, step.dimensions, i),
			);
		}
	}

	const modeCountMap = new Map<string, number>();
	for (const item of syntheticCases) {
		const failureMode = item.failureMode ?? "unknown";
		modeCountMap.set(failureMode, (modeCountMap.get(failureMode) ?? 0) + 1);
	}

	return {
		sourceCases: rows.length,
		sourceFailures: failedRows.length,
		selectedFailureModes,
		dimensionNames,
		dimensionCombinationCount: combinations.length,
		generated: syntheticCases.length,
		modeCounts: [...modeCountMap.entries()]
			.map(([failureMode, count]) => ({ failureMode, count }))
			.sort(
				(a, b) =>
					b.count - a.count || a.failureMode.localeCompare(b.failureMode),
			),
		outputPath: options.outputPath ?? DEFAULT_SYNTHETIC_DATASET_PATH,
		cases: syntheticCases,
	};
}

export function formatSynthesizeHuman(summary: SynthesizeSummary): string {
	const lines = [
		"Synthesize phase",
		`Source cases: ${summary.sourceCases}`,
		`Source failures: ${summary.sourceFailures}`,
		`Failure modes used: ${summary.selectedFailureModes.length}`,
		`Dimension combinations: ${summary.dimensionCombinationCount}`,
		`Generated synthetic cases: ${summary.generated}`,
	];

	if (summary.selectedFailureModes.length > 0) {
		lines.push(`Modes: ${summary.selectedFailureModes.join(", ")}`);
	}
	if (summary.dimensionNames.length > 0) {
		lines.push(`Dimensions: ${summary.dimensionNames.join(", ")}`);
	}
	if (summary.modeCounts.length > 0) {
		lines.push(
			`Mode counts: ${summary.modeCounts.map((item) => `${item.failureMode} ×${item.count}`).join(", ")}`,
		);
	}
	if (summary.cases.length > 0) {
		lines.push(
			`Samples: ${summary.cases
				.slice(0, 3)
				.map((item) => `${item.caseId} (${dimensionLabel(item.dimensions)})`)
				.join(", ")}`,
		);
	}

	return lines.join("\n");
}

function writeSyntheticDataset(
	cases: SyntheticGoldenCase[],
	outputPath: string,
): void {
	const directory = path.dirname(outputPath);
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
	const content = cases.map((item) => JSON.stringify(item)).join("\n");
	fs.writeFileSync(
		outputPath,
		content.length > 0 ? `${content}\n` : "",
		"utf8",
	);
}

export function runSynthesize(argv: string[]): number {
	const options = parseSynthesizeArgs(argv);
	let labeledRows: LabeledGoldenCase[];
	try {
		const raw = fs.readFileSync(options.datasetPath, "utf8");
		labeledRows = parseLabeledDataset(raw);
	} catch (error) {
		console.error(
			`EvalGate synthesize ERROR: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 2;
	}

	let dimensions: Record<string, string[]> = {};
	if (options.dimensionsPath) {
		try {
			const raw = fs.readFileSync(options.dimensionsPath, "utf8");
			dimensions = parseDimensionMatrix(raw).dimensions;
		} catch (error) {
			console.error(
				`EvalGate synthesize ERROR: ${error instanceof Error ? error.message : String(error)}`,
			);
			return 2;
		}
	}

	const summary = synthesizeLabeledDataset(labeledRows, {
		dimensions,
		count: options.count,
		failureModes: options.failureModes,
		outputPath: options.outputPath,
	});

	if (summary.selectedFailureModes.length === 0) {
		console.error(
			"EvalGate synthesize ERROR: no failed labeled cases with failure modes were found",
		);
		return 2;
	}

	try {
		writeSyntheticDataset(summary.cases, options.outputPath);
	} catch (error) {
		console.error(
			`EvalGate synthesize ERROR: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 3;
	}

	if (options.format === "json") {
		console.log(JSON.stringify(summary, null, 2));
	} else {
		console.log(formatSynthesizeHuman(summary));
		console.log(
			`\nSaved → ${path.relative(process.cwd(), options.outputPath)}`,
		);
	}

	return 0;
}
