export const MIN_DISCRIMINATIVE_POWER = 0.05;
export const MIN_BOOTSTRAP_SAMPLE_SIZE = 30;

export type CorrectionGuardReason =
	| "judge_too_weak_to_correct"
	| "insufficient_samples_for_ci";

export interface CorrectedPassRateResult {
	rawPassRate: number;
	correctedPassRate: number;
	applied: boolean;
	discriminativePower: number;
	warning?: CorrectionGuardReason;
}

export interface CorrectedPassRateInput {
	rawPassRate: number;
	tpr: number;
	tnr: number;
	nearRandomThreshold?: number;
}

export interface BootstrapCIInput {
	outcomes: boolean[];
	tpr: number;
	tnr: number;
	iterations: number;
	seed: number;
	minSampleSizeForCI?: number;
	nearRandomThreshold?: number;
}

export interface BootstrapCIResult {
	low?: number;
	high?: number;
	applied: boolean;
	warning?: CorrectionGuardReason;
}

function clamp01(value: number): number {
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function createSeededRng(seed: number): () => number {
	let state = (seed >>> 0) + 0x6d2b79f5;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function quantile(sortedValues: number[], q: number): number {
	if (sortedValues.length === 0) return 0;
	const clampedQ = Math.min(1, Math.max(0, q));
	const idx = Math.floor((sortedValues.length - 1) * clampedQ);
	return sortedValues[idx];
}

export function computeCorrectedPassRate(
	input: CorrectedPassRateInput,
): CorrectedPassRateResult {
	const threshold = input.nearRandomThreshold ?? MIN_DISCRIMINATIVE_POWER;
	const discriminativePower = input.tpr + input.tnr - 1;

	if (discriminativePower <= threshold) {
		return {
			rawPassRate: clamp01(input.rawPassRate),
			correctedPassRate: clamp01(input.rawPassRate),
			applied: false,
			discriminativePower,
			warning: "judge_too_weak_to_correct",
		};
	}

	const corrected = (input.rawPassRate + input.tnr - 1) / discriminativePower;
	return {
		rawPassRate: clamp01(input.rawPassRate),
		correctedPassRate: clamp01(corrected),
		applied: true,
		discriminativePower,
	};
}

export function computeBootstrapCI(input: BootstrapCIInput): BootstrapCIResult {
	const minSample = input.minSampleSizeForCI ?? MIN_BOOTSTRAP_SAMPLE_SIZE;
	if (input.outcomes.length < minSample) {
		return { applied: false, warning: "insufficient_samples_for_ci" };
	}

	const baseCorrection = computeCorrectedPassRate({
		rawPassRate: 0.5,
		tpr: input.tpr,
		tnr: input.tnr,
		nearRandomThreshold: input.nearRandomThreshold,
	});
	if (!baseCorrection.applied) {
		return { applied: false, warning: "judge_too_weak_to_correct" };
	}

	const rng = createSeededRng(input.seed);
	const n = input.outcomes.length;
	const correctedSamples: number[] = [];
	for (let i = 0; i < input.iterations; i++) {
		let passCount = 0;
		for (let j = 0; j < n; j++) {
			const pick = Math.floor(rng() * n);
			if (input.outcomes[pick]) passCount++;
		}
		const rawPassRate = passCount / n;
		const corrected = computeCorrectedPassRate({
			rawPassRate,
			tpr: input.tpr,
			tnr: input.tnr,
			nearRandomThreshold: input.nearRandomThreshold,
		});
		correctedSamples.push(corrected.correctedPassRate);
	}

	correctedSamples.sort((a, b) => a - b);
	return {
		low: quantile(correctedSamples, 0.025),
		high: quantile(correctedSamples, 0.975),
		applied: true,
	};
}
