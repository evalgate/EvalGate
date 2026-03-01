/**
 * EvalGate Runtime Registry - Layer 1 Foundation
 *
 * Scoped registry with proper lifecycle management.
 * Prevents cross-run contamination and memory leaks.
 */
import type { EvalRuntime } from "./types";
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
    position: {
        line: number;
        column: number;
    };
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
 * Create a new scoped runtime with lifecycle management
 * Returns a handle for proper resource management
 */
export declare function createEvalRuntime(projectRoot?: string): RuntimeHandle;
/**
 * Helper function for safe runtime execution with automatic cleanup
 * Ensures runtime is disposed even if an exception is thrown
 */
export declare function withRuntime<T>(projectRoot: string, fn: (handle: RuntimeHandle) => Promise<T>): Promise<T>;
export declare function getActiveRuntime(): EvalRuntime;
/**
 * Set the active runtime (for backward compatibility)
 */
export declare function setActiveRuntime(runtime: EvalRuntime): void;
/**
 * Dispose the active runtime (for backward compatibility)
 */
export declare function disposeActiveRuntime(): void;
