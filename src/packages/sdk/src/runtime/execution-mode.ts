/**
 * COMPAT-204: Dual-path execution toggle
 *
 * Environment flag EVALAI_RUNTIME=legacy|spec|auto
 * Auto uses spec runtime if manifest/specs exist, else legacy
 * Existing projects continue unchanged; new projects can use DSL only
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Execution mode types
 */
export type ExecutionMode = "legacy" | "spec" | "auto";

/**
 * Execution mode configuration
 */
export interface ExecutionModeConfig {
	/** Current execution mode */
	mode: ExecutionMode;
	/** Whether spec runtime is available */
	hasSpecRuntime: boolean;
	/** Whether legacy runtime is available */
	hasLegacyRuntime: boolean;
	/** Project root path */
	projectRoot: string;
	/** Detected spec files */
	specFiles: string[];
	/** Detected legacy config */
	legacyConfig?: string;
}

/**
 * Get execution mode from environment or auto-detection
 */
export async function getExecutionMode(
	projectRoot: string = process.cwd(),
): Promise<ExecutionModeConfig> {
	// Check environment variable first
	const envMode = process.env.EVALAI_RUNTIME?.toLowerCase();

	if (envMode === "legacy" || envMode === "spec" || envMode === "auto") {
		return {
			mode: envMode as ExecutionMode,
			hasSpecRuntime: envMode !== "legacy",
			hasLegacyRuntime: envMode !== "spec",
			projectRoot,
			specFiles: envMode !== "legacy" ? await findSpecFiles(projectRoot) : [],
			legacyConfig:
				envMode !== "spec" ? await findLegacyConfig(projectRoot) : undefined,
		};
	}

	// Auto-detect mode
	return await autoDetectExecutionMode(projectRoot);
}

/**
 * Auto-detect execution mode based on project structure
 */
async function autoDetectExecutionMode(
	projectRoot: string,
): Promise<ExecutionModeConfig> {
	const specFiles = await findSpecFiles(projectRoot);
	const legacyConfig = await findLegacyConfig(projectRoot);

	const hasSpecRuntime = specFiles.length > 0;
	const hasLegacyRuntime = !!legacyConfig;

	let mode: ExecutionMode = "auto";

	// If both are available, prefer spec runtime for new projects
	if (hasSpecRuntime && hasLegacyRuntime) {
		mode = "spec"; // Prefer spec for mixed projects
	} else if (hasSpecRuntime) {
		mode = "spec";
	} else if (hasLegacyRuntime) {
		mode = "legacy";
	} else {
		mode = "auto"; // Default to auto for empty projects
	}

	return {
		mode,
		hasSpecRuntime,
		hasLegacyRuntime,
		projectRoot,
		specFiles,
		legacyConfig,
	};
}

/**
 * Find spec files in project
 */
async function findSpecFiles(projectRoot: string): Promise<string[]> {
	const specPatterns = [
		"eval/**/*.spec.ts",
		"eval/**/*.spec.js",
		"src/**/*.spec.ts",
		"src/**/*.spec.js",
		"tests/**/*.spec.ts",
		"tests/**/*.spec.js",
		"spec/**/*.ts",
		"spec/**/*.js",
	];

	const foundFiles: string[] = [];

	for (const pattern of specPatterns) {
		try {
			const files = await searchFiles(projectRoot, pattern, projectRoot);
			foundFiles.push(...files);
		} catch (_error) {
			// Ignore errors for non-existent paths
		}
	}

	// Filter for files that contain defineEval calls
	const specFilesWithDefineEval: string[] = [];

	for (const file of foundFiles) {
		try {
			const content = await fs.readFile(file, "utf-8");
			if (content.includes("defineEval")) {
				specFilesWithDefineEval.push(file);
			}
		} catch (_error) {
			// Ignore read errors
		}
	}

	return specFilesWithDefineEval;
}

/**
 * Simple file search (placeholder for proper glob implementation)
 */
async function searchFiles(
	dir: string,
	pattern: string,
	projectRoot: string,
): Promise<string[]> {
	const results: string[] = [];

	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				results.push(...(await searchFiles(fullPath, pattern, projectRoot)));
			} else if (entry.isFile()) {
				// Simple pattern matching
				if (matchesPattern(fullPath, pattern, projectRoot)) {
					results.push(fullPath);
				}
			}
		}
	} catch (_error) {
		// Ignore permission errors
	}

	return results;
}

/**
 * Simple pattern matching (placeholder for proper glob)
 */
function matchesPattern(
	filePath: string,
	pattern: string,
	projectRoot: string,
): boolean {
	const _fileName = path.basename(filePath);
	const _ext = path.extname(filePath);
	const _dir = path.dirname(filePath);

	// Convert glob pattern to regex
	// Handle **/ and * patterns correctly
	let regexPattern = pattern;

	// Replace **/ with (?:.*/)? to match optional directory path
	regexPattern = regexPattern.replace(/\*\*\//g, "(?:.*/)?");

	// Replace remaining * with [^/]* (filename pattern)
	regexPattern = regexPattern.replace(/\*/g, "[^/]*");

	const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
	const regex = new RegExp(`^${regexPattern}$`);

	return regex.test(relativePath);
}

/**
 * Find legacy config file
 */
async function findLegacyConfig(
	projectRoot: string,
): Promise<string | undefined> {
	const configPaths = [
		"evalai.config.json",
		"evalai.config.js",
		"evalai.config.ts",
		".evalairc",
		".evalairc.json",
	];

	for (const configPath of configPaths) {
		const fullPath = path.join(projectRoot, configPath);
		try {
			await fs.access(fullPath);
			return fullPath;
		} catch (_error) {
			// File doesn't exist, continue
		}
	}

	return undefined;
}

/**
 * Check if project can run in spec mode
 */
export function canRunSpecMode(config: ExecutionModeConfig): boolean {
	return config.hasSpecRuntime && config.specFiles.length > 0;
}

/**
 * Check if project can run in legacy mode
 */
export function canRunLegacyMode(config: ExecutionModeConfig): boolean {
	return config.hasLegacyRuntime && !!config.legacyConfig;
}

/**
 * Get recommended execution mode for project
 */
export function getRecommendedExecutionMode(
	config: ExecutionModeConfig,
): ExecutionMode {
	if (config.mode !== "auto") {
		return config.mode;
	}

	if (canRunSpecMode(config) && canRunLegacyMode(config)) {
		return "spec"; // Prefer spec for mixed projects
	}

	if (canRunSpecMode(config)) {
		return "spec";
	}

	if (canRunLegacyMode(config)) {
		return "legacy";
	}

	return "auto";
}

/**
 * Validate execution mode compatibility
 */
export function validateExecutionMode(config: ExecutionModeConfig): {
	valid: boolean;
	warnings: string[];
	errors: string[];
} {
	const warnings: string[] = [];
	const errors: string[] = [];

	// Check for mixed project
	if (config.hasSpecRuntime && config.hasLegacyRuntime) {
		warnings.push(
			"Project contains both spec files and legacy config. " +
				"Consider migrating legacy tests to spec format for consistency.",
		);
	}

	// Check for no runtime
	if (!config.hasSpecRuntime && !config.hasLegacyRuntime) {
		warnings.push(
			"No tests found. This appears to be an empty project. " +
				"Use 'evalai init' to create a new project.",
		);
	}

	// Check for spec mode without spec files
	if (config.mode === "spec" && !canRunSpecMode(config)) {
		errors.push(
			"Spec mode requested but no spec files found. " +
				"Create spec files with defineEval() or use legacy mode.",
		);
	}

	// Check for legacy mode without config
	if (config.mode === "legacy" && !canRunLegacyMode(config)) {
		errors.push(
			"Legacy mode requested but no evalai.config.json found. " +
				"Create a config file or use spec mode.",
		);
	}

	return {
		valid: errors.length === 0,
		warnings,
		errors,
	};
}

/**
 * Print execution mode information
 */
export function printExecutionModeInfo(config: ExecutionModeConfig): void {
	console.log(`🔧 EvalAI Execution Mode: ${config.mode.toUpperCase()}`);
	console.log(`📁 Project root: ${config.projectRoot}`);
	console.log(``);

	if (config.hasSpecRuntime) {
		console.log(`✅ Spec runtime available`);
		console.log(`   Found ${config.specFiles.length} spec file(s):`);
		config.specFiles.slice(0, 5).forEach((file) => {
			console.log(`   - ${path.relative(config.projectRoot, file)}`);
		});
		if (config.specFiles.length > 5) {
			console.log(`   ... and ${config.specFiles.length - 5} more`);
		}
	} else {
		console.log(`❌ No spec runtime found`);
	}

	console.log(``);

	if (config.hasLegacyRuntime) {
		console.log(`✅ Legacy runtime available`);
		if (config.legacyConfig) {
			console.log(
				`   Config: ${path.relative(config.projectRoot, config.legacyConfig)}`,
			);
		}
	} else {
		console.log(`❌ No legacy runtime found`);
	}

	console.log(``);

	const validation = validateExecutionMode(config);

	if (validation.warnings.length > 0) {
		console.log(`⚠️  Warnings:`);
		validation.warnings.forEach((warning) => console.log(`   ${warning}`));
		console.log(``);
	}

	if (validation.errors.length > 0) {
		console.log(`❌ Errors:`);
		validation.errors.forEach((error) => console.log(`   ${error}`));
		console.log(``);
	}

	const recommended = getRecommendedExecutionMode(config);
	console.log(`💡 Recommended mode: ${recommended.toUpperCase()}`);

	if (config.mode === "auto") {
		console.log(`🔄 Auto mode will use: ${recommended.toUpperCase()}`);
	}
}

/**
 * Environment variable helpers
 */
export const ENV_VARS = {
	EXECUTION_MODE: "EVALAI_RUNTIME",
	POSSIBLE_VALUES: ["legacy", "spec", "auto"],
	DEFAULT: "auto",
} as const;

/**
 * Check if environment variable is set
 */
export function hasExecutionModeEnv(): boolean {
	return !!process.env.EVALAI_RUNTIME;
}

/**
 * Get current environment variable value
 */
export function getExecutionModeEnv(): string | undefined {
	return process.env.EVALAI_RUNTIME;
}

/**
 * Set execution mode environment variable
 */
export function setExecutionModeEnv(mode: ExecutionMode): void {
	process.env.EVALAI_RUNTIME = mode;
}

/**
 * Clear execution mode environment variable
 */
export function clearExecutionModeEnv(): void {
	delete process.env.EVALAI_RUNTIME;
}
