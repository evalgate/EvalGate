/**
 * EvalGate defineEval() DSL - Layer 1 Foundation
 *
 * The core DSL function for defining behavioral specifications.
 * Uses content-addressable identity with AST position for stability.
 */

import * as crypto from "node:crypto";
import * as path from "node:path";
import { getActiveRuntime } from "./registry";
import type {
	DefineEvalFunction,
	EvalContext,
	EvalExecutor,
	EvalResult,
	EvalSpec,
	SpecConfig,
	SpecOptions,
} from "./types";
import { SpecRegistrationError } from "./types";

/**
 * Extract AST position from call stack
 * This provides stable identity that survives renames but changes when logic moves
 */
function getCallerPosition(): {
	line: number;
	column: number;
	filePath: string;
} {
	const stack = new Error().stack;
	if (!stack) {
		throw new SpecRegistrationError("Unable to determine caller position");
	}

	// Parse stack trace to find the caller
	const lines = stack.split("\n");

	// Skip current function and find the actual caller
	for (let i = 3; i < lines.length; i++) {
		const line = lines[i];
		if (
			!line ||
			line.includes("node_modules") ||
			line.includes("internal/modules")
		) {
			continue;
		}

		// Extract file path, line, and column
		const match = line.match(/at\s+.*?\((.*?):(\d+):(\d+)\)/);
		if (match) {
			const [, filePath, lineNum, colNum] = match;
			return {
				filePath: path.resolve(filePath),
				line: parseInt(lineNum, 10),
				column: parseInt(colNum, 10),
			};
		}

		// Alternative format for some environments
		const altMatch = line.match(/at\s+(.*?):(\d+):(\d+)/);
		if (altMatch) {
			const [, filePath, lineNum, colNum] = altMatch;
			return {
				filePath: path.resolve(filePath),
				line: parseInt(lineNum, 10),
				column: parseInt(colNum, 10),
			};
		}
	}

	throw new SpecRegistrationError(
		"Unable to parse caller position from stack trace",
	);
}

/**
 * Generate content-addressable specification ID
 */
function generateSpecId(
	namespace: string,
	filePath: string,
	name: string,
	position: { line: number; column: number },
): string {
	// Canonicalize path: relative to project root with POSIX separators
	const projectRoot = process.cwd();
	const relativePath = path.relative(projectRoot, filePath);
	const canonicalPath = relativePath.split(path.sep).join("/"); // Force POSIX separators

	const components = [
		namespace,
		canonicalPath,
		name,
		`${position.line}:${position.column}`,
	];

	const content = components.join("|");
	return crypto.createHash("sha256").update(content).digest("hex").slice(0, 20);
}

/**
 * Validate specification name
 */
function validateSpecName(name: string): void {
	if (!name || typeof name !== "string") {
		throw new SpecRegistrationError(
			"Specification name must be a non-empty string",
		);
	}

	if (name.trim() === "") {
		throw new SpecRegistrationError("Specification name cannot be empty");
	}

	if (name.length > 100) {
		throw new SpecRegistrationError(
			"Specification name must be 100 characters or less",
		);
	}

	// Check for invalid characters
	if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
		throw new SpecRegistrationError(
			"Specification name can only contain letters, numbers, spaces, hyphens, and underscores",
		);
	}
}

/**
 * Validate executor function
 */
function validateExecutor(executor: EvalExecutor): void {
	if (typeof executor !== "function") {
		throw new SpecRegistrationError("Executor must be a function");
	}

	// Check function length (should accept context parameter)
	if (executor.length > 1) {
		throw new SpecRegistrationError(
			"Executor should accept exactly one parameter (context)",
		);
	}
}

/**
 * Create specification configuration from parameters
 */
function createSpecConfig(
	nameOrConfig: string | SpecConfig,
	executor?: EvalExecutor,
	options?: SpecOptions,
): SpecConfig {
	if (typeof nameOrConfig === "string") {
		// defineEval(name, executor, options) form
		if (!executor) {
			throw new SpecRegistrationError(
				"Executor function is required when using name parameter",
			);
		}

		return {
			name: nameOrConfig,
			executor,
			...options,
		};
	} else {
		// defineEval(config) form
		return nameOrConfig;
	}
}

/**
 * Core defineEval function implementation
 */
function defineEvalImpl<_TInput = string>(
	nameOrConfig: string | SpecConfig,
	executor?: EvalExecutor,
	options?: SpecOptions,
): void {
	// Get caller position for identity
	const callerPosition = getCallerPosition();

	// Create specification configuration
	const config = createSpecConfig(nameOrConfig, executor, options);

	// Validate configuration
	validateSpecName(config.name);
	validateExecutor(config.executor);

	// Get active runtime
	const runtime = getActiveRuntime();

	// Generate specification ID
	const specId = generateSpecId(
		runtime.namespace,
		callerPosition.filePath,
		config.name,
		callerPosition,
	);

	// Create specification
	const spec: EvalSpec = {
		id: specId,
		name: config.name,
		filePath: callerPosition.filePath,
		position: callerPosition,
		description: config.description,
		tags: config.tags,
		executor: config.executor,
		metadata: config.metadata,
		config: {
			timeout: config.timeout,
			retries: config.retries,
			budget: config.budget,
			model: config.model,
		},
	};

	// Register specification
	runtime.register(spec);
}

/**
 * Export the defineEval function with proper typing
 * This is the main DSL entry point
 */
export const defineEval: DefineEvalFunction = defineEvalImpl;

/**
 * Convenience export for evalai.test() alias (backward compatibility)
 * Provides alternative naming that matches the original roadmap vision
 */
export const evalai = {
	test: defineEval,
};

/**
 * Suite definition for grouping related specifications.
 * Accepts both a positional form and an object form:
 *
 * @example Positional form:
 * defineSuite('My Suite', [() => defineEval('spec 1', executor), ...])
 *
 * @example Object form:
 * defineSuite({ name: 'My Suite', specs: [() => defineEval('spec 1', executor), ...] })
 */
export function defineSuite(
	nameOrConfig: string | { name: string; specs: (() => void)[] },
	specsArg?: (() => void)[],
): void {
	const specFns =
		typeof nameOrConfig === "string"
			? (specsArg ?? [])
			: (nameOrConfig.specs ?? []);
	// Execute each spec function to register its defineEval calls
	// In Layer 3, this will also build the dependency graph
	for (const specFn of specFns) {
		specFn();
	}
}

/**
 * Helper function to create specification contexts
 * Useful for testing and manual execution
 */
export function createContext<TInput = string>(
	input: TInput,
	metadata?: Record<string, unknown>,
	options?: EvalContext["options"],
): EvalContext & { input: TInput } {
	return {
		input: input as string & TInput,
		metadata,
		options,
	};
}

/**
 * Helper function to create specification results
 * Provides a convenient builder pattern for common result patterns
 */
export function createResult(config: {
	pass: boolean;
	score: number;
	assertions?: EvalResult["assertions"];
	metadata?: Record<string, unknown>;
	error?: string;
}): EvalResult {
	return {
		pass: config.pass,
		score: Math.max(0, Math.min(100, config.score)), // Clamp to 0-100
		assertions: config.assertions,
		metadata: config.metadata,
		error: config.error,
	};
}

/**
 * Default export for convenience
 */
export default defineEval;
