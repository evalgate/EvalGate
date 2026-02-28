/**
 * TICKET 2 — Evaluation Manifest Generation
 *
 * Goal: turn discovery output into a stable, versioned, machine-consumable artifact
 * that becomes the input to run / impact / diff.
 *
 * This is the compiler output that everything else consumes.
 */
import type { SpecAnalysis } from "./discover";
import type { ExecutionModeConfig } from "../runtime/execution-mode";
/**
 * Manifest schema version
 */
export declare const MANIFEST_SCHEMA_VERSION = 1;
/**
 * SDK version from package.json
 */
export declare const SDK_VERSION = "1.8.0";
/**
 * Evaluation Manifest Schema
 */
export interface EvaluationManifest {
    /** Schema version for compatibility */
    schemaVersion: number;
    /** When this manifest was generated */
    generatedAt: number;
    /** Project metadata */
    project: {
        name: string;
        root: string;
        namespace: string;
    };
    /** Runtime information */
    runtime: {
        mode: "spec" | "legacy";
        sdkVersion: string;
    };
    /** Spec files with hashes */
    specFiles: SpecFile[];
    /** Individual specifications */
    specs: Spec[];
}
/**
 * Spec file information
 */
export interface SpecFile {
    /** POSIX-relative file path */
    filePath: string;
    /** SHA-256 hash of file content */
    fileHash: string;
    /** Number of specs in this file */
    specCount: number;
}
/**
 * Individual specification
 */
export interface Spec {
    /** Stable canonical ID */
    id: string;
    /** Spec name */
    name: string;
    /** Suite path from tags or file structure */
    suitePath: string[];
    /** POSIX-relative file path */
    filePath: string;
    /** Position in file */
    position: {
        line: number;
        column: number;
    };
    /** Tags/categories */
    tags: string[];
    /** Dependencies */
    dependsOn: {
        prompts: string[];
        datasets: string[];
        tools: string[];
        code: string[];
    };
}
/**
 * Lock file for caching
 */
export interface ManifestLock {
    /** When lock was generated */
    generatedAt: number;
    /** File hashes for incremental updates */
    fileHashes: Record<string, string>;
}
/**
 * Generate evaluation manifest from discovery results
 */
export declare function generateManifest(specs: SpecAnalysis[], projectRoot: string, projectName: string, executionMode: ExecutionModeConfig): Promise<EvaluationManifest>;
/**
 * Write manifest to disk
 */
export declare function writeManifest(manifest: EvaluationManifest, projectRoot: string): Promise<void>;
/**
 * Read existing manifest
 */
export declare function readManifest(projectRoot: string): Promise<EvaluationManifest | null>;
/**
 * Read existing lock file
 */
export declare function readLock(projectRoot: string): Promise<ManifestLock | null>;
