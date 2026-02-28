/**
 * EvalAI Runtime Registry - Layer 1 Foundation
 *
 * Scoped registry with proper lifecycle management.
 * Prevents cross-run contamination and memory leaks.
 */

import * as crypto from "node:crypto";
import * as path from "node:path";
import type {
	EvalRuntime,
	EvalSpec,
	RuntimeHealth,
	RuntimeStats,
	SpecSearchCriteria,
} from "./types";
import { RuntimeError, SpecRegistrationError } from "./types";

/**
 * Runtime interface with lifecycle management
 * Ensures proper cleanup and prevents resource leaks
 */
export interface RuntimeHandle {
	/** Runtime instance */
	runtime: EvalRuntime;
	/** defineEval function bound to this runtime */
	defineEval: typeof import("./eval").defineEval;
	/** Dispose runtime and clean up resources */
	dispose(): void;
	/** Create runtime snapshot for persistence */
	snapshot(): RuntimeSnapshot;
	/** Load runtime from snapshot */
	load(snapshot: RuntimeSnapshot): void;
}

/**
 * Runtime snapshot for persistence and recovery
 */
export interface RuntimeSnapshot {
	/** Runtime metadata */
	runtimeId: string;
	namespace: string;
	createdAt: string;
	/** Serialized specifications */
	specs: SerializedSpec[];
	/** Snapshot version for compatibility */
	version: string;
}

/**
 * Serialized specification for snapshot
 */
export interface SerializedSpec {
	id: string;
	name: string;
	filePath: string;
	position: { line: number; column: number };
	description?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
	config?: {
		timeout?: number;
		retries?: number;
		budget?: string;
		model?: string | "auto";
	};
	/** Serialized executor function (placeholder) */
	executorSerialized: boolean;
}

/**
 * Runtime registry implementation
 * Scoped lifecycle with proper memory management
 */
class EvalRuntimeImpl implements EvalRuntime {
	public readonly id: string;
	public readonly namespace: string;
	public readonly createdAt: Date;
	public readonly specs = new Map<string, EvalSpec>();
	private disposed = false;

	constructor(projectRoot: string) {
		this.id = crypto.randomUUID();
		this.namespace = this.generateNamespace(projectRoot);
		this.createdAt = new Date();
	}

	/**
	 * Generate project namespace from project root
	 * Content-addressable to prevent collisions
	 */
	private generateNamespace(projectRoot: string): string {
		return crypto
			.createHash("sha256")
			.update(path.resolve(projectRoot))
			.digest("hex")
			.slice(0, 12);
	}

	/**
	 * Register a new specification
	 */
	register(spec: EvalSpec): void {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed", {
				runtimeId: this.id,
				namespace: this.namespace,
			});
		}

		// Validate specification
		this.validateSpec(spec);

		// Check for existing spec with same ID
		if (this.specs.has(spec.id)) {
			throw new SpecRegistrationError(
				`Specification with ID '${spec.id}' already exists`,
				{
					specId: spec.id,
					specName: spec.name,
					filePath: spec.filePath,
				},
			);
		}

		// Register specification
		this.specs.set(spec.id, spec);
	}

	/**
	 * Get specification by ID
	 */
	get(id: string): EvalSpec | undefined {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}
		return this.specs.get(id);
	}

	/**
	 * List all registered specifications
	 */
	list(): EvalSpec[] {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}
		return Array.from(this.specs.values());
	}

	/**
	 * Find specifications by criteria
	 */
	find(criteria: SpecSearchCriteria): EvalSpec[] {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}

		return Array.from(this.specs.values()).filter((spec) => {
			// Tag filtering
			if (criteria.tags && criteria.tags.length > 0) {
				const specTags = spec.tags || [];
				if (!criteria.tags.some((tag) => specTags.includes(tag))) {
					return false;
				}
			}

			// File filtering
			if (criteria.files && criteria.files.length > 0) {
				if (!criteria.files.includes(spec.filePath)) {
					return false;
				}
			}

			// Name filtering
			if (criteria.names && criteria.names.length > 0) {
				if (!criteria.names.includes(spec.name)) {
					return false;
				}
			}

			// Metadata filtering
			if (criteria.metadata) {
				const specMetadata = spec.metadata || {};
				for (const [key, value] of Object.entries(criteria.metadata)) {
					if (specMetadata[key] !== value) {
						return false;
					}
				}
			}

			return true;
		});
	}

	/**
	 * Clear all specifications and dispose runtime
	 */
	clear(): void {
		this.specs.clear();
		this.disposed = true;
	}

	/**
	 * Create runtime snapshot for persistence
	 */
	snapshot(): RuntimeSnapshot {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}

		const serializedSpecs: SerializedSpec[] = Array.from(
			this.specs.values(),
		).map((spec) => ({
			id: spec.id,
			name: spec.name,
			filePath: spec.filePath,
			position: spec.position,
			description: spec.description,
			tags: spec.tags,
			metadata: spec.metadata,
			config: spec.config,
			executorSerialized: false, // Cannot serialize functions
		}));

		return {
			runtimeId: this.id,
			namespace: this.namespace,
			createdAt: this.createdAt.toISOString(),
			specs: serializedSpecs,
			version: "1.0.0",
		};
	}

	/**
	 * Load runtime from snapshot
	 * Note: Executors cannot be serialized and must be recreated
	 */
	load(snapshot: RuntimeSnapshot): void {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}

		if (snapshot.runtimeId !== this.id) {
			throw new RuntimeError(
				"Snapshot runtime ID does not match current runtime",
			);
		}

		if (snapshot.namespace !== this.namespace) {
			throw new RuntimeError(
				"Snapshot namespace does not match current runtime",
			);
		}

		// Clear current specs
		this.specs.clear();

		// Load specs from snapshot (without executors)
		for (const serializedSpec of snapshot.specs) {
			// Note: Executors cannot be restored from snapshot
			// Users must recreate the defineEval calls to restore executors
			console.warn(
				`Cannot restore executor for spec '${serializedSpec.name}' from snapshot`,
			);
		}
	}

	/**
	 * Get runtime statistics
	 */
	get stats(): RuntimeStats {
		if (this.disposed) {
			throw new RuntimeError("Runtime has been disposed");
		}

		const specsByTag: Record<string, number> = {};
		const specsByFile: Record<string, number> = {};

		for (const spec of this.specs.values()) {
			// Count by tags
			const tags = spec.tags || [];
			for (const tag of tags) {
				specsByTag[tag] = (specsByTag[tag] || 0) + 1;
			}

			// Count by files
			specsByFile[spec.filePath] = (specsByFile[spec.filePath] || 0) + 1;
		}

		// Estimate memory usage (rough calculation)
		const memoryUsage = this.estimateMemoryUsage();

		return {
			totalSpecs: this.specs.size,
			specsByTag,
			specsByFile,
			memoryUsage,
			lastUpdated: new Date(),
		};
	}

	/**
	 * Get runtime health information
	 */
	getHealth(): RuntimeHealth {
		if (this.disposed) {
			return {
				status: "error",
				memoryUsage: 0,
				specCount: 0,
				issues: ["Runtime has been disposed"],
			};
		}

		const issues: string[] = [];
		const memoryUsage = this.estimateMemoryUsage();

		// Memory usage warnings
		if (memoryUsage > 50 * 1024 * 1024) {
			// 50MB
			issues.push("High memory usage detected");
		}

		// Spec count warnings
		if (this.specs.size > 10000) {
			issues.push("Large number of specifications may impact performance");
		}

		let status: "healthy" | "warning" | "error" = "healthy";
		if (issues.length > 0) {
			status = issues.some((issue) => issue.includes("error"))
				? "error"
				: "warning";
		}

		return {
			status,
			memoryUsage,
			specCount: this.specs.size,
			issues,
		};
	}

	/**
	 * Validate specification before registration
	 */
	private validateSpec(spec: EvalSpec): void {
		if (!spec.name || spec.name.trim() === "") {
			throw new SpecRegistrationError("Specification name is required", {
				spec,
			});
		}

		if (!spec.filePath || spec.filePath.trim() === "") {
			throw new SpecRegistrationError("Specification file path is required", {
				spec,
			});
		}

		if (!spec.executor || typeof spec.executor !== "function") {
			throw new SpecRegistrationError(
				"Specification executor is required and must be a function",
				{
					spec,
				},
			);
		}

		if (
			!spec.position ||
			typeof spec.position.line !== "number" ||
			typeof spec.position.column !== "number"
		) {
			throw new SpecRegistrationError(
				"Specification AST position is required",
				{
					spec,
				},
			);
		}

		// Validate ID format
		if (!spec.id || spec.id.length !== 20) {
			throw new SpecRegistrationError(
				"Specification ID must be 20 characters long",
				{
					spec,
				},
			);
		}
	}

	/**
	 * Estimate memory usage of the registry
	 */
	private estimateMemoryUsage(): number {
		// Rough estimation: each spec ~1KB of data
		return this.specs.size * 1024;
	}
}

/**
 * Create a new scoped runtime with lifecycle management
 * Returns a handle for proper resource management
 */
export function createEvalRuntime(
	projectRoot: string = process.cwd(),
): RuntimeHandle {
	const runtime = new EvalRuntimeImpl(projectRoot);

	// Create bound defineEval function
	const boundDefineEval = ((
		nameOrConfig: unknown,
		executor?: unknown,
		options?: unknown,
	) => {
		// Temporarily set this runtime as active
		const previousRuntime = activeRuntime;
		activeRuntime = runtime;

		try {
			// Import and call defineEval
			const { defineEval } = require("./eval");
			return defineEval(nameOrConfig, executor, options);
		} finally {
			// Restore previous runtime
			activeRuntime = previousRuntime;
		}
	}) as typeof import("./eval").defineEval;

	return {
		runtime,
		defineEval: boundDefineEval,
		dispose: () => {
			runtime.clear();
			if (activeRuntime === runtime) {
				activeRuntime = null;
			}
		},
		snapshot: () => runtime.snapshot(),
		load: (snapshot: RuntimeSnapshot) => runtime.load(snapshot),
	};
}

/**
 * Helper function for safe runtime execution with automatic cleanup
 * Ensures runtime is disposed even if an exception is thrown
 */
export async function withRuntime<T>(
	projectRoot: string,
	fn: (handle: RuntimeHandle) => Promise<T>,
): Promise<T> {
	const handle = createEvalRuntime(projectRoot);

	try {
		return await fn(handle);
	} finally {
		// Always dispose, even on exception
		handle.dispose();
	}
}

/**
 * Get the currently active runtime (for backward compatibility)
 */
let activeRuntime: EvalRuntimeImpl | null = null;

export function getActiveRuntime(): EvalRuntime {
	if (!activeRuntime) {
		activeRuntime = new EvalRuntimeImpl(process.cwd());
	}
	return activeRuntime;
}

/**
 * Set the active runtime (for backward compatibility)
 */
export function setActiveRuntime(runtime: EvalRuntime): void {
	if (activeRuntime) {
		throw new RuntimeError("Active runtime already exists");
	}
	activeRuntime = runtime as EvalRuntimeImpl;
}

/**
 * Dispose the active runtime (for backward compatibility)
 */
export function disposeActiveRuntime(): void {
	if (activeRuntime) {
		activeRuntime.clear();
		activeRuntime = null;
	}
}

/**
 * Runtime cleanup hook for process termination
 */
process.on("exit", () => {
	disposeActiveRuntime();
});

process.on("SIGINT", () => {
	disposeActiveRuntime();
	process.exit(0);
});

process.on("SIGTERM", () => {
	disposeActiveRuntime();
	process.exit(0);
});
