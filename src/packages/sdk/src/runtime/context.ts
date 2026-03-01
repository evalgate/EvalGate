/**
 * EvalGate Runtime Context - Layer 1 Foundation
 *
 * Execution context management for specifications.
 * Provides clean isolation and proper resource management.
 */

import type { EvalContext, EvalOptions } from "./types";

/**
 * Create a new execution context
 */
export function createContext<TInput = string>(
	input: TInput,
	metadata?: Record<string, unknown>,
	options?: EvalOptions,
): EvalContext & { input: TInput } {
	return {
		input: input as string & TInput,
		metadata,
		options,
	};
}

/**
 * Merge contexts with proper precedence
 * Later contexts override earlier ones
 */
export function mergeContexts(
	base: EvalContext,
	...overrides: Partial<EvalContext>[]
): EvalContext {
	// Ensure base has a valid input
	if (!base.input) {
		throw new Error("Base context must have a valid input");
	}

	const merged = overrides.reduce(
		(merged, override) => ({
			input: override.input ?? merged.input,
			metadata: {
				...merged.metadata,
				...override.metadata,
			},
			options: override.options
				? {
						...merged.options,
						...override.options,
					}
				: merged.options,
		}),
		base,
	);

	// Type assertion since we've ensured input exists
	return merged as EvalContext;
}

/**
 * Clone a context for safe modification
 */
export function cloneContext(context: EvalContext): EvalContext {
	return {
		input: context.input,
		metadata: { ...context.metadata },
		options: context.options ? { ...context.options } : undefined,
	};
}

/**
 * Validate context structure
 */
export function validateContext(context: EvalContext): void {
	if (!context || typeof context !== "object") {
		throw new Error("Context must be an object");
	}

	if (typeof context.input !== "string") {
		throw new Error("Context input must be a string");
	}

	if (context.metadata && typeof context.metadata !== "object") {
		throw new Error("Context metadata must be an object");
	}

	if (context.options && typeof context.options !== "object") {
		throw new Error("Context options must be an object");
	}
}
