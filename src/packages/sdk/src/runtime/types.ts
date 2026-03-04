/**
 * EvalGate Runtime Types - Layer 1 Foundation
 *
 * Core types for the evaluation specification programming model.
 * Everything revolves around the Evaluation Specification primitive.
 */

import type { AssertionResult } from "../assertions";

/**
 * Core evaluation specification - the single primitive
 * Represents a behavioral specification test
 */
export interface EvalSpec {
	/** Content-addressable unique identifier */
	id: string;
	/** Human-readable name */
	name: string;
	/** File path where this spec is defined */
	filePath: string;
	/** AST position for identity stability */
	position: { line: number; column: number };
	/** Specification description */
	description?: string;
	/** Categorization tags */
	tags?: string[];
	/** Specification execution function */
	executor: EvalExecutor;
	/** Specification metadata */
	metadata?: Record<string, unknown>;
	/** Execution configuration */
	config?: {
		timeout?: number;
		retries?: number;
		budget?: string;
		model?: string | "auto";
	};
	/** Filtering mode: skip = registered but never executed, only = exclusive execution */
	mode?: "normal" | "skip" | "only";
}

/**
 * Specification execution context
 */
export interface EvalContext {
	/** Test input data */
	input: string;
	/** Context metadata */
	metadata?: Record<string, unknown>;
	/** Execution options */
	options?: EvalOptions;
}

/**
 * Execution options
 */
export interface EvalOptions {
	/** Model selection */
	model?: string | "auto";
	/** Budget constraint */
	budget?: string;
	/** Timeout override */
	timeout?: number;
	/** Custom execution parameters */
	[key: string]: unknown;
}

/**
 * Specification executor function
 */
export type EvalExecutor = (context: EvalContext) => Promise<EvalResult>;

/**
 * Specification execution result
 */
export interface EvalResult {
	/** Pass/fail determination */
	pass: boolean;
	/** Numeric score (0-100) */
	score: number;
	/** Assertion results */
	assertions?: AssertionResult[];
	/** Result metadata */
	metadata?: Record<string, unknown>;
	/** Execution duration */
	durationMs?: number;
	/** Execution error if failed */
	error?: string;
	/** Generated output text */
	output?: string;
	/** Token count consumed */
	tokens?: number;
}

/**
 * Scoped runtime context - prevents cross-run contamination
 */
export interface EvalRuntime {
	/** Runtime unique identifier */
	id: string;
	/** Project namespace */
	namespace: string;
	/** Runtime creation timestamp */
	createdAt: Date;
	/** Registered specifications */
	specs: Map<string, EvalSpec>;
	/** Runtime statistics */
	stats: RuntimeStats;
	/** Register a new specification */
	register(spec: EvalSpec): void;
	/** Get specification by ID */
	get(id: string): EvalSpec | undefined;
	/** List all specifications */
	list(): EvalSpec[];
	/** Find specifications by criteria */
	find(criteria: SpecSearchCriteria): EvalSpec[];
	/** Clear all specifications (dispose) */
	clear(): void;
	/** Get runtime health metrics */
	getHealth(): RuntimeHealth;
}

/**
 * Specification search criteria
 */
export interface SpecSearchCriteria {
	tags?: string[];
	files?: string[];
	names?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Runtime statistics
 */
export interface RuntimeStats {
	/** Total registered specs */
	totalSpecs: number;
	/** Specs by tag */
	specsByTag: Record<string, number>;
	/** Specs by file */
	specsByFile: Record<string, number>;
	/** Memory usage estimate */
	memoryUsage: number;
	/** Last updated timestamp */
	lastUpdated: Date;
}

/**
 * Runtime health information
 */
export interface RuntimeHealth {
	/** Runtime status */
	status: "healthy" | "warning" | "error";
	/** Memory usage in bytes */
	memoryUsage: number;
	/** Number of registered specs */
	specCount: number;
	/** Health issues if any */
	issues: string[];
}

/**
 * Content-addressable identity components
 */
export interface SpecIdentity {
	/** Project namespace hash */
	namespace: string;
	/** Relative file path */
	filePath: string;
	/** Specification name */
	name: string;
	/** Suite path if nested */
	suitePath?: string;
	/** AST position */
	position: { line: number; column: number };
}

/**
 * Specification definition function signature
 * This is the defineEval() DSL function signature
 */
export interface DefineEvalFunction {
	/**
	 * Define a behavioral specification
	 * @param name - Human-readable specification name
	 * @param executor - Specification execution function
	 * @param options - Optional configuration
	 */
	<TInput = string>(
		name: string,
		executor: (context: EvalContext & { input: TInput }) => Promise<EvalResult>,
		options?: SpecOptions,
	): void;

	/**
	 * Define a specification with full configuration
	 * @param config - Complete specification configuration
	 */
	(config: SpecConfig): void;

	/**
	 * Register a specification but skip it during execution.
	 * Follows the vitest/jest `.skip` convention.
	 */
	skip: DefineEvalFunction;

	/**
	 * Register a specification for exclusive execution.
	 * If any spec is marked `.only`, only those specs run.
	 * Follows the vitest/jest `.only` convention.
	 */
	only: DefineEvalFunction;
}

/**
 * Specification definition options
 */
export interface SpecOptions {
	/** Specification description */
	description?: string;
	/** Categorization tags */
	tags?: string[];
	/** Execution timeout */
	timeout?: number;
	/** Retry attempts */
	retries?: number;
	/** Budget constraint */
	budget?: string;
	/** Model selection */
	model?: string | "auto";
	/** Specification metadata */
	metadata?: Record<string, unknown>;
	/** Dependencies for impact analysis */
	dependsOn?: {
		prompts?: string[];
		datasets?: string[];
		tools?: string[];
		code?: string[];
	};
}

/**
 * Complete specification configuration
 */
export interface SpecConfig extends SpecOptions {
	/** Specification name (required) */
	name: string;
	/** Specification executor (required) */
	executor: EvalExecutor;
}

/**
 * Execution interface - abstraction layer
 * Prevents worker coupling and enables multiple backends
 */
export interface EvalExecutorInterface {
	/** Execute a single specification */
	executeSpec(spec: EvalSpec, input: string): Promise<EvalResult>;
	/** Execute multiple specifications */
	executeSpecs(specs: EvalSpec[], inputs: string[]): Promise<EvalResult[]>;
	/** Get executor capabilities */
	getCapabilities(): ExecutorCapabilities;
}

/**
 * Executor capabilities
 */
export interface ExecutorCapabilities {
	/** Executor type */
	type: "local" | "cloud" | "worker";
	/** Parallel execution support */
	parallel: boolean;
	/** Maximum parallel workers */
	maxParallel?: number;
	/** Supported models */
	supportedModels: string[];
	/** Cost tracking support */
	costTracking: boolean;
	/** Streaming support */
	streaming: boolean;
}

/**
 * Local executor implementation
 */
export interface LocalExecutor extends EvalExecutorInterface {
	type: "local";
}

/**
 * Cloud executor implementation
 */
export interface CloudExecutor extends EvalExecutorInterface {
	type: "cloud";
	/** Cloud provider */
	provider: string;
	/** Region */
	region?: string;
}

/**
 * Worker executor implementation
 */
export interface WorkerExecutor extends EvalExecutorInterface {
	type: "worker";
	/** Worker pool configuration */
	workerPool: {
		size: number;
		maxMemory: number;
		timeout: number;
	};
}

/**
 * Runtime errors
 */
export class EvalRuntimeError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "EvalRuntimeError";
	}
}

export class SpecRegistrationError extends EvalRuntimeError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "SPEC_REGISTRATION_ERROR", details);
		this.name = "SpecRegistrationError";
	}
}

export class SpecExecutionError extends EvalRuntimeError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "SPEC_EXECUTION_ERROR", details);
		this.name = "SpecExecutionError";
	}
}

export class RuntimeError extends EvalRuntimeError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "RUNTIME_ERROR", details);
		this.name = "RuntimeError";
	}
}

/**
 * EvalExecutionError wrapper for safe error boundaries
 */
export class EvalExecutionError extends Error {
	public readonly name = "EvalExecutionError";
	public readonly code: string;
	public readonly testId: string;
	public readonly filePath: string;
	public readonly position: { line: number; column: number };
	public readonly originalError?: Error;

	constructor(
		message: string,
		context: {
			testId: string;
			filePath: string;
			position: { line: number; column: number };
			code?: string;
			originalError?: Error;
		},
	) {
		super(message);
		this.code = context.code || "EXECUTION_ERROR";
		this.testId = context.testId;
		this.filePath = context.filePath;
		this.position = context.position;
		this.originalError = context.originalError;

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, EvalExecutionError);
		}
	}

	/**
	 * Convert to normalized error envelope for reporting
	 */
	toEnvelope(): ExecutionErrorEnvelope {
		return {
			classification: "execution_error",
			code: this.code,
			message: this.message,
			stack: this.stack,
			testId: this.testId,
			filePath: this.filePath,
			position: this.position,
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Normalized error envelope for reporting
 */
export interface ExecutionErrorEnvelope {
	/** Error classification */
	classification:
		| "execution_error"
		| "timeout_error"
		| "assertion_error"
		| "system_error";
	/** Error code for programmatic handling */
	code: string;
	/** Human-readable error message */
	message: string;
	/** Stack trace if available */
	stack?: string;
	/** Test specification ID */
	testId: string;
	/** File where error occurred */
	filePath: string;
	/** Position in file where error occurred */
	position: { line: number; column: number };
	/** Error timestamp */
	timestamp: string;
}

/**
 * Enhanced execution result with error classification
 */
export interface EnhancedEvalResult extends EvalResult {
	/** Error envelope if execution failed */
	errorEnvelope?: ExecutionErrorEnvelope;
	/** Execution classification */
	classification: "passed" | "failed" | "error" | "timeout";
}
