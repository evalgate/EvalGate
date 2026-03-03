/**
 * evalgate print-config — Show resolved configuration with source-of-truth annotations.
 *
 * Prints every config field, where it came from (file, env, default, CLI arg),
 * and redacts secrets. Useful for debugging "why is it using this baseUrl?"
 *
 * Usage:
 *   evalgate print-config
 *   evalgate print-config --format json
 *
 * Exit codes:
 *   0 — Always (informational only)
 */

import * as path from "node:path";

import { SDK_VERSION } from "../version";
import {
	type EvalAIConfig,
	findConfigPath,
	loadConfig,
	mergeConfigWithArgs,
} from "./config";
import { PROFILES, type ProfileName } from "./profiles";

// ── Types ──

type Source = "file" | "env" | "default" | "profile" | "arg";

interface ResolvedField {
	key: string;
	value: string | number | boolean | null;
	source: Source;
	raw?: string;
}

export interface PrintConfigOutput {
	cliVersion: string;
	configFile: string | null;
	cwd: string;
	resolved: ResolvedField[];
	env: Record<string, string | null>;
}

// ── Arg parsing ──

interface PrintConfigFlags {
	format: "human" | "json";
	// Allow passthrough of check-like args to show how they'd merge
	evaluationId?: string;
	baseUrl?: string;
	apiKey?: string;
	baseline?: string;
	profile?: string;
	minScore?: string;
	maxDrop?: string;
	warnDrop?: string;
	minN?: string;
}

function parseFlags(argv: string[]): PrintConfigFlags {
	const raw: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
				raw[key] = next;
				i++;
			} else {
				raw[key] = "true";
			}
		}
	}

	return {
		format: raw.format === "json" ? "json" : "human",
		evaluationId: raw.evaluationId,
		baseUrl: raw.baseUrl,
		apiKey: raw.apiKey,
		baseline: raw.baseline,
		profile: raw.profile,
		minScore: raw.minScore,
		maxDrop: raw.maxDrop,
		warnDrop: raw.warnDrop,
		minN: raw.minN,
	};
}

// ── Helpers ──

function redact(value: string | undefined | null): string | null {
	if (!value) return null;
	if (value.length > 8) return `${value.slice(0, 4)}...${value.slice(-4)}`;
	return "****";
}

// ── Build resolved config ──

function buildResolvedConfig(
	cwd: string,
	flags: PrintConfigFlags,
): PrintConfigOutput {
	const configPath = findConfigPath(cwd);
	const fileConfig = loadConfig(cwd);

	// Build CLI args object (only what was explicitly passed)
	const cliArgs: Partial<Record<string, string | number | boolean>> = {};
	if (flags.evaluationId) cliArgs.evaluationId = flags.evaluationId;
	if (flags.baseUrl) cliArgs.baseUrl = flags.baseUrl;
	if (flags.baseline) cliArgs.baseline = flags.baseline;
	if (flags.profile) cliArgs.profile = flags.profile;
	if (flags.minScore) cliArgs.minScore = flags.minScore;
	if (flags.maxDrop) cliArgs.maxDrop = flags.maxDrop;
	if (flags.warnDrop) cliArgs.warnDrop = flags.warnDrop;
	if (flags.minN) cliArgs.minN = flags.minN;

	const merged = mergeConfigWithArgs(fileConfig, cliArgs);

	// Determine source of each field
	const fields: ResolvedField[] = [];

	// evaluationId
	const evalIdSource: Source = flags.evaluationId
		? "arg"
		: fileConfig?.evaluationId
			? "file"
			: "default";
	fields.push({
		key: "evaluationId",
		value: merged.evaluationId ?? null,
		source: evalIdSource,
	});

	// baseUrl
	const envBaseUrl = process.env.EVALGATE_BASE_URL;
	const baseUrlSource: Source = flags.baseUrl
		? "arg"
		: envBaseUrl
			? "env"
			: fileConfig?.baseUrl
				? "file"
				: "default";
	fields.push({
		key: "baseUrl",
		value:
			flags.baseUrl ||
			envBaseUrl ||
			fileConfig?.baseUrl ||
			"https://api.evalgate.com",
		source: baseUrlSource,
	});

	// apiKey (always redacted)
	const envApiKey = process.env.EVALGATE_API_KEY;
	const rawApiKey = flags.apiKey || envApiKey || "";
	const apiKeySource: Source = flags.apiKey
		? "arg"
		: envApiKey
			? "env"
			: "default";
	fields.push({
		key: "apiKey",
		value: redact(rawApiKey) ?? "(not set)",
		source: apiKeySource,
		raw: rawApiKey ? "(redacted)" : undefined,
	});

	// profile
	const profileName = (flags.profile || fileConfig?.profile) as
		| ProfileName
		| undefined;
	const profileSource: Source = flags.profile
		? "arg"
		: fileConfig?.profile
			? "file"
			: "default";
	fields.push({
		key: "profile",
		value: profileName ?? null,
		source: profileSource,
	});

	// Numeric gate fields: minScore, maxDrop, warnDrop, minN, allowWeakEvidence
	const numericFields: Array<{ key: keyof EvalAIConfig; envKey?: string }> = [
		{ key: "minScore" },
		{ key: "maxDrop" },
		{ key: "warnDrop" },
		{ key: "minN" },
		{ key: "allowWeakEvidence" },
	];

	for (const { key } of numericFields) {
		const argVal = cliArgs[key];
		const fileVal = fileConfig?.[key];
		const profileVal =
			profileName && profileName in PROFILES
				? (PROFILES[profileName as ProfileName] as Record<string, unknown>)[key]
				: undefined;

		const source: Source =
			argVal !== undefined
				? "arg"
				: fileVal !== undefined
					? "file"
					: profileVal !== undefined
						? "profile"
						: "default";

		fields.push({
			key,
			value: (merged[key] as string | number | boolean) ?? null,
			source,
		});
	}

	// baseline
	const baselineSource: Source = flags.baseline
		? "arg"
		: fileConfig?.baseline
			? "file"
			: "default";
	fields.push({
		key: "baseline",
		value: merged.baseline ?? "published",
		source: baselineSource,
	});

	// Environment variables summary
	const envVars: Record<string, string | null> = {
		EVALGATE_API_KEY: redact(envApiKey),
		EVALGATE_BASE_URL: envBaseUrl ?? null,
		OPENAI_API_KEY: redact(process.env.OPENAI_API_KEY),
		ANTHROPIC_API_KEY: redact(process.env.ANTHROPIC_API_KEY),
		AZURE_OPENAI_API_KEY: redact(process.env.AZURE_OPENAI_API_KEY),
		GITHUB_ACTIONS: process.env.GITHUB_ACTIONS ?? null,
		CI: process.env.CI ?? null,
	};

	return {
		cliVersion: SDK_VERSION,
		configFile: configPath ? path.relative(cwd, configPath) : null,
		cwd,
		resolved: fields,
		env: envVars,
	};
}

// ── Output formatting ──

function printHuman(output: PrintConfigOutput): void {
	console.log("\n  evalgate print-config\n");

	console.log(`  CLI version: ${output.cliVersion}`);
	console.log(`  Config file: ${output.configFile ?? "(none found)"}`);
	console.log(`  Working dir: ${output.cwd}`);
	console.log("");

	console.log("  Resolved configuration:");
	console.log("");

	const maxKeyLen = Math.max(...output.resolved.map((f) => f.key.length));

	for (const field of output.resolved) {
		const val = field.value === null ? "(not set)" : String(field.value);
		const pad = " ".repeat(maxKeyLen - field.key.length);
		const sourceTag = `[${field.source}]`;
		console.log(`    ${field.key}${pad}  ${val}  ${sourceTag}`);
	}

	console.log("");
	console.log("  Environment variables:");
	console.log("");

	for (const [key, val] of Object.entries(output.env)) {
		if (val !== null) {
			console.log(`    ${key} = ${val}`);
		}
	}

	const unsetEnv = Object.entries(output.env)
		.filter(([, v]) => v === null)
		.map(([k]) => k);
	if (unsetEnv.length > 0) {
		console.log(`    (not set: ${unsetEnv.join(", ")})`);
	}
	console.log("");
}

// ── Main ──

export function runPrintConfig(argv: string[]): number {
	const flags = parseFlags(argv);
	const cwd = process.cwd();
	const output = buildResolvedConfig(cwd, flags);

	if (flags.format === "json") {
		console.log(JSON.stringify(output, null, 2));
	} else {
		printHuman(output);
	}

	return 0;
}
