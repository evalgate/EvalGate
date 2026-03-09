/**
 * EvalGate config loader
 * Discovery: evalgate.config.json → evalgate.config.js → evalgate.config.cjs → package.json evalgate
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { PROFILES, type ProfileName } from "./profiles";

const DEFAULT_JUDGE_BOOTSTRAP_ITERATIONS = 2000;
const DEFAULT_JUDGE_BOOTSTRAP_SEED = 42;

export interface JudgeSplitConfig {
	train?: number;
	dev?: number;
	test?: number;
}

export interface JudgeAlignmentThresholdsConfig {
	tprMin?: number;
	tnrMin?: number;
	minLabeledSamples?: number;
}

export interface JudgeConfig {
	labeledDatasetPath?: string;
	split?: JudgeSplitConfig;
	alignmentThresholds?: JudgeAlignmentThresholdsConfig;
	bootstrapIterations?: number;
	bootstrapSeed?: number;
}

export interface FailureModeImpact {
	/** Impact weight for prioritization (higher = more critical) */
	weight: number;
	/** Alert threshold: fail if count exceeds this number */
	alertThreshold?: number;
	/** Alert threshold: fail if percentage exceeds this value (0-1) */
	alertThresholdPercent?: number;
}

export interface FailureModeAlertsConfig {
	/** Per-failure-mode impact weights and alert thresholds */
	modes: Record<string, FailureModeImpact>;
	/** Global alert threshold: fail if any failure mode exceeds this */
	globalAlertThreshold?: number;
	/** Global alert threshold: fail if total failure percentage exceeds this (0-1) */
	globalAlertThresholdPercent?: number;
}

export interface CostSource {
	provider: "stripe" | "manual";
	stripeMeterId?: string; // Stripe meter ID for automatic pricing
	manualPricePerTrace?: number; // Fallback: $ per trace (estimated)
}

export interface NormalizedBudgetConfig {
	/** Budget mode: traces (simple) or cost (economically accurate) */
	mode: "traces" | "cost";
	/** Maximum number of traces to run */
	maxTraces?: number;
	/** Maximum cost in USD */
	maxCostUsd?: number;
	/** Cost data source when mode is "cost" */
	costSource?: CostSource;
}

export interface EvalAIConfig {
	evaluationId?: string;
	apiKey?: string;
	baseUrl?: string;
	minScore?: number;
	minN?: number;
	maxDrop?: number;
	warnDrop?: number;
	allowWeakEvidence?: boolean;
	baseline?: "published" | "previous" | "production" | "auto";
	profile?: ProfileName;
	judge?: JudgeConfig;
	failureModeAlerts?: FailureModeAlertsConfig;
	normalizedBudget?: NormalizedBudgetConfig;
	/** Monorepo: package path → config. Key = path relative to config dir (e.g. "apps/web", "packages/api"). */
	packages?: Record<string, Partial<EvalAIConfig>>;
}

function normalizeJudgeConfig(judge?: JudgeConfig): JudgeConfig | undefined {
	if (!judge) return undefined;
	return {
		...judge,
		bootstrapIterations:
			judge.bootstrapIterations ?? DEFAULT_JUDGE_BOOTSTRAP_ITERATIONS,
		bootstrapSeed: judge.bootstrapSeed ?? DEFAULT_JUDGE_BOOTSTRAP_SEED,
	};
}

const CONFIG_FILES = [
	"evalgate.config.json",
	"evalgate.config.js",
	"evalgate.config.cjs",
	"evalai.config.json",
	"evalai.config.js",
	"evalai.config.cjs",
];

/**
 * Find config file path in directory, walking up to root
 */
export function findConfigPath(cwd: string = process.cwd()): string | null {
	let dir = path.resolve(cwd);
	const root = path.parse(dir).root;

	while (dir !== root) {
		for (const file of CONFIG_FILES) {
			const filePath = path.join(dir, file);
			if (fs.existsSync(filePath)) {
				return filePath;
			}
		}
		// Check package.json for evalgate or evalai field
		const pkgPath = path.join(dir, "package.json");
		if (fs.existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
				if (pkg.evalgate != null || pkg.evalai != null) {
					return pkgPath;
				}
			} catch {
				// ignore
			}
		}
		dir = path.dirname(dir);
	}

	return null;
}

/**
 * Load config from file system
 */
export function loadConfig(cwd: string = process.cwd()): EvalAIConfig | null {
	const configPath = findConfigPath(cwd);
	if (!configPath) return null;

	try {
		let config: EvalAIConfig | null = null;

		if (configPath.endsWith("package.json")) {
			const pkg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
			config = (pkg.evalgate ?? pkg.evalai) as EvalAIConfig | null;
		} else {
			const content = fs.readFileSync(configPath, "utf-8");
			if (configPath.endsWith(".json")) {
				config = JSON.parse(content) as EvalAIConfig;
			} else if (configPath.endsWith(".js") || configPath.endsWith(".cjs")) {
				try {
					config = JSON.parse(content) as EvalAIConfig;
				} catch {
					return null;
				}
			}
		}

		if (!config) return null;

		if (config.packages && Object.keys(config.packages).length > 0) {
			const configDir = path.dirname(configPath);
			const rel = path.relative(configDir, path.resolve(cwd));
			const relNorm = rel.split(path.sep).join("/");
			const pkgConfig = config.packages[relNorm];
			if (pkgConfig) {
				return {
					...config,
					...pkgConfig,
					judge: normalizeJudgeConfig({ ...config.judge, ...pkgConfig.judge }),
					packages: config.packages,
				};
			}
			for (const key of Object.keys(config.packages)) {
				if (relNorm === key || relNorm.startsWith(`${key}/`)) {
					return {
						...config,
						...config.packages[key],
						judge: normalizeJudgeConfig({
							...config.judge,
							...config.packages[key].judge,
						}),
						packages: config.packages,
					};
				}
			}
		}

		return {
			...config,
			judge: normalizeJudgeConfig(config.judge),
		};
	} catch {
		return null;
	}
}

/**
 * Check failure mode alert thresholds and return alert messages for any breaches.
 */
export function checkFailureModeAlerts(
	failureModes: Record<string, number>,
	totalFailed: number,
	config: FailureModeAlertsConfig,
): string[] {
	const alerts: string[] = [];

	for (const [mode, count] of Object.entries(failureModes)) {
		const modeConfig = config.modes[mode];
		if (!modeConfig) continue;

		const percentage = count / totalFailed;

		if (modeConfig.alertThreshold && count > modeConfig.alertThreshold) {
			alerts.push(
				`${mode}: count ${count} exceeds threshold ${modeConfig.alertThreshold}`,
			);
		}

		if (
			modeConfig.alertThresholdPercent &&
			percentage > modeConfig.alertThresholdPercent
		) {
			alerts.push(
				`${mode}: ${(percentage * 100).toFixed(1)}% exceeds threshold ${(modeConfig.alertThresholdPercent * 100).toFixed(1)}%`,
			);
		}
	}

	if (
		config.globalAlertThreshold &&
		totalFailed > config.globalAlertThreshold
	) {
		alerts.push(
			`Total failures ${totalFailed} exceeds global threshold ${config.globalAlertThreshold}`,
		);
	}

	if (config.globalAlertThresholdPercent) {
		const totalTests = Object.values(failureModes).reduce(
			(sum, count) => sum + count,
			0,
		);
		const failureRate = totalFailed / totalTests;
		if (failureRate > config.globalAlertThresholdPercent) {
			alerts.push(
				`Failure rate ${(failureRate * 100).toFixed(1)}% exceeds global threshold ${(config.globalAlertThresholdPercent * 100).toFixed(1)}%`,
			);
		}
	}

	return alerts;
}

/**
 * Merge config with CLI args. Priority: args > profile > config > defaults.
 */
export function mergeConfigWithArgs(
	config: EvalAIConfig | null,
	args: Partial<Record<string, string | number | boolean>>,
): Partial<EvalAIConfig> {
	const merged: Partial<EvalAIConfig> = {};

	if (config) {
		if (config.evaluationId) merged.evaluationId = config.evaluationId;
		if (config.baseUrl) merged.baseUrl = config.baseUrl;
		if (config.minScore != null) merged.minScore = config.minScore;
		if (config.minN != null) merged.minN = config.minN;
		if (config.maxDrop != null) merged.maxDrop = config.maxDrop;
		if (config.warnDrop != null) merged.warnDrop = config.warnDrop;
		if (config.allowWeakEvidence != null)
			merged.allowWeakEvidence = config.allowWeakEvidence;
		if (config.baseline) merged.baseline = config.baseline;
		if (config.profile) merged.profile = config.profile;
		if (config.judge) merged.judge = normalizeJudgeConfig(config.judge);
	}

	// Profile defaults (from --profile or config.profile). Apply before args override.
	const profileName = (args.profile ?? merged.profile) as
		| ProfileName
		| undefined;
	if (profileName && profileName in PROFILES) {
		const profile = PROFILES[profileName as ProfileName];
		if (merged.minScore === undefined && args.minScore === undefined)
			merged.minScore = profile.minScore;
		if (merged.maxDrop === undefined && args.maxDrop === undefined)
			merged.maxDrop = profile.maxDrop;
		if (
			merged.warnDrop === undefined &&
			args.warnDrop === undefined &&
			"warnDrop" in profile
		)
			merged.warnDrop = profile.warnDrop;
		if (merged.minN === undefined && args.minN === undefined)
			merged.minN = profile.minN;
		if (
			merged.allowWeakEvidence === undefined &&
			args.allowWeakEvidence === undefined
		)
			merged.allowWeakEvidence = profile.allowWeakEvidence;
	}

	// Args override
	if (args.evaluationId !== undefined && args.evaluationId !== "") {
		merged.evaluationId = String(args.evaluationId);
	}
	if (args.baseUrl !== undefined && args.baseUrl !== "") {
		merged.baseUrl = String(args.baseUrl);
	}
	if (args.minScore !== undefined) {
		merged.minScore =
			typeof args.minScore === "number"
				? args.minScore
				: parseInt(String(args.minScore), 10);
	}
	if (args.maxDrop !== undefined) {
		merged.maxDrop =
			typeof args.maxDrop === "number"
				? args.maxDrop
				: parseInt(String(args.maxDrop), 10);
	}
	if (args.warnDrop !== undefined) {
		merged.warnDrop =
			typeof args.warnDrop === "number"
				? args.warnDrop
				: parseInt(String(args.warnDrop), 10);
	}
	if (args.minN !== undefined) {
		merged.minN =
			typeof args.minN === "number"
				? args.minN
				: parseInt(String(args.minN), 10);
	}
	if (args.allowWeakEvidence !== undefined) {
		merged.allowWeakEvidence =
			args.allowWeakEvidence === true ||
			args.allowWeakEvidence === "true" ||
			args.allowWeakEvidence === "1";
	}
	if (args.baseline !== undefined && args.baseline !== "") {
		const b = String(args.baseline);
		if (b === "auto" || b === "previous" || b === "production") {
			merged.baseline = b;
		} else {
			merged.baseline = "published";
		}
	}
	if (args.profile !== undefined && args.profile !== "") {
		merged.profile = String(args.profile) as ProfileName;
	}

	return merged;
}
