import {
	type LabeledGoldenCase,
	parseLabeledDataset,
} from "@/lib/evalgate/analyze-core";

export type SynthesizeFormat = "human" | "json";

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
	cases: SyntheticGoldenCase[];
}

export interface DimensionMatrix {
	dimensions: Record<string, string[]>;
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
		const failureMode = row.failureMode?.trim();
		if (!failureMode) continue; // Skip if failureMode is empty/undefined
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
		for (let index = 0; index < targetCount; index++) {
			const step = plan[index % plan.length]!;
			const sourceRows = grouped.get(step.failureMode)!;
			const prototype =
				sourceRows[Math.floor(index / plan.length) % sourceRows.length]!;
			syntheticCases.push(
				buildSyntheticCase(prototype, step.failureMode, step.dimensions, index),
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
		cases: syntheticCases,
	};
}

export function synthesizeFromDatasetContent(
	datasetContent: string,
	options: {
		dimensions?: Record<string, string[]>;
		count?: number | null;
		failureModes?: string[];
	},
): SynthesizeSummary {
	return synthesizeLabeledDataset(parseLabeledDataset(datasetContent), options);
}
