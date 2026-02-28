/**
 * TICKET 2 — Evaluation Manifest Generation
 *
 * Goal: turn discovery output into a stable, versioned, machine-consumable artifact
 * that becomes the input to run / impact / diff.
 *
 * This is the compiler output that everything else consumes.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExecutionModeConfig } from "../runtime/execution-mode";
import { SDK_VERSION } from "../version";
import type { SpecAnalysis } from "./discover";

export { SDK_VERSION };

/**
 * Manifest schema version
 */
export const MANIFEST_SCHEMA_VERSION = 1;

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
export async function generateManifest(
	specs: SpecAnalysis[],
	projectRoot: string,
	projectName: string,
	executionMode: ExecutionModeConfig,
): Promise<EvaluationManifest> {
	const generatedAt = Math.floor(Date.now() / 1000);
	const namespace = generateNamespace(projectRoot);

	// Process spec files and specs
	const specFiles: SpecFile[] = [];
	const processedSpecs: Spec[] = [];

	// Group specs by file
	const specsByFile = new Map<string, SpecAnalysis[]>();
	for (const spec of specs) {
		const normalizedPath = normalizePath(spec.file, projectRoot);
		if (!specsByFile.has(normalizedPath)) {
			specsByFile.set(normalizedPath, []);
		}
		specsByFile.get(normalizedPath)?.push(spec);
	}

	// Process each file
	for (const [filePath, fileSpecs] of specsByFile) {
		const absolutePath = path.join(projectRoot, filePath);
		const fileHash = await hashFile(absolutePath);

		specFiles.push({
			filePath,
			fileHash,
			specCount: fileSpecs.length,
		});

		// Process individual specs
		for (const spec of fileSpecs) {
			const processedSpec = await processSpec(spec, filePath, projectRoot);
			processedSpecs.push(processedSpec);
		}
	}

	return {
		schemaVersion: MANIFEST_SCHEMA_VERSION,
		generatedAt,
		project: {
			name: projectName,
			root: ".",
			namespace,
		},
		runtime: {
			mode: executionMode.mode as "spec" | "legacy",
			sdkVersion: SDK_VERSION,
		},
		specFiles,
		specs: processedSpecs,
	};
}

/**
 * Process individual specification
 */
async function processSpec(
	spec: SpecAnalysis,
	filePath: string,
	projectRoot: string,
): Promise<Spec> {
	const absolutePath = path.join(projectRoot, filePath);
	const content = await fs.readFile(absolutePath, "utf-8");

	// Extract position from AST analysis (simplified for now)
	const position = extractPosition(content, spec.name);

	// Extract dependencies from content
	const dependsOn = extractDependencies(content);

	// Generate suite path from tags or file structure
	const suitePath = generateSuitePath(spec.tags, filePath);

	return {
		id: spec.id,
		name: spec.name,
		suitePath,
		filePath: normalizePath(spec.file, projectRoot),
		position,
		tags: spec.tags,
		dependsOn,
	};
}

/**
 * Extract position from content (simplified implementation)
 */
function extractPosition(
	content: string,
	specName: string,
): { line: number; column: number } {
	const lines = content.split("\n");
	const specPattern = new RegExp(
		`defineEval\\s*\\(\\s*["'\`]${specName}["'\`]`,
		"g",
	);
	let match: RegExpExecArray | null = null;
	let line = 1;
	let column = 1;

	for (let i = 0; i < lines.length; i++) {
		const lineContent = lines[i];
		specPattern.lastIndex = 0;
		match = specPattern.exec(lineContent);

		if (match) {
			line = i + 1;
			column = match.index + 1;
			break;
		}
	}

	return { line, column };
}

/**
 * Extract dependencies from content
 */
function extractDependencies(content: string): Spec["dependsOn"] {
	const dependsOn: Spec["dependsOn"] = {
		prompts: [],
		datasets: [],
		tools: [],
		code: [],
	};

	// Extract from dependsOn option if present
	const dependsOnMatch = content.match(/dependsOn\s*:\s*({[^}]+})/s);
	if (dependsOnMatch) {
		try {
			// Use JSON.parse instead of eval for safety
			const deps = JSON.parse(dependsOnMatch[1]);
			return {
				prompts: deps.prompts || [],
				datasets: deps.datasets || [],
				tools: deps.tools || [],
				code: deps.code || [],
			};
		} catch (_error) {
			// If parsing fails, return empty dependencies
			return {
				prompts: [],
				datasets: [],
				tools: [],
				code: [],
			};
		}
	}

	// Simple extraction as fallback
	const patterns = {
		prompts: /["']([^"']*\.md)["']/g,
		datasets: /["']([^"']*\.json)["']/g,
		tools: /["']([^"']*\.ts)["']/g,
		code: /import.*from\s*["']([^"']+)["']/g,
	};

	for (const [type, pattern] of Object.entries(patterns)) {
		let match: RegExpExecArray | null;
		match = pattern.exec(content);
		while (match !== null) {
			dependsOn[type as keyof Spec["dependsOn"]].push(match[1]);
			match = pattern.exec(content);
		}
	}

	return dependsOn;
}

/**
 * Generate suite path from tags or file structure
 */
function generateSuitePath(tags: string[], filePath: string): string[] {
	// Use tags as primary suite path
	if (tags.length > 0) {
		return [tags[0]];
	}

	// Fall back to file structure
	const parts = filePath.split("/");
	if (parts.length > 1) {
		return [parts[0]];
	}

	return ["general"];
}

/**
 * Generate namespace from project root
 */
function generateNamespace(projectRoot: string): string {
	const hash = crypto.createHash("sha256");
	hash.update(projectRoot);
	return hash.digest("hex").slice(0, 8);
}

/**
 * Normalize path to POSIX format
 */
function normalizePath(filePath: string, projectRoot: string): string {
	const relativePath = path.relative(projectRoot, filePath);
	return relativePath.replace(/\\/g, "/");
}

/**
 * Hash file content
 */
async function hashFile(filePath: string): Promise<string> {
	const content = await fs.readFile(filePath, "utf-8");
	const hash = crypto.createHash("sha256");
	hash.update(content);
	return `sha256:${hash.digest("hex")}`;
}

/**
 * Write manifest to disk
 */
export async function writeManifest(
	manifest: EvaluationManifest,
	projectRoot: string,
): Promise<void> {
	const evalaiDir = path.join(projectRoot, ".evalai");

	// Ensure .evalai directory exists
	await fs.mkdir(evalaiDir, { recursive: true });

	// Write manifest.json
	const manifestPath = path.join(evalaiDir, "manifest.json");
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

	// Write lock file
	const lock: ManifestLock = {
		generatedAt: manifest.generatedAt,
		fileHashes: Object.fromEntries(
			manifest.specFiles.map((f) => [f.filePath, f.fileHash]),
		),
	};

	const lockPath = path.join(evalaiDir, "manifest.lock.json");
	await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), "utf-8");
}

/**
 * Read existing manifest
 */
export async function readManifest(
	projectRoot: string,
): Promise<EvaluationManifest | null> {
	const manifestPath = path.join(projectRoot, ".evalai", "manifest.json");

	try {
		const content = await fs.readFile(manifestPath, "utf-8");
		return JSON.parse(content) as EvaluationManifest;
	} catch (_error) {
		return null;
	}
}

/**
 * Read existing lock file
 */
export async function readLock(
	projectRoot: string,
): Promise<ManifestLock | null> {
	const lockPath = path.join(projectRoot, ".evalai", "manifest.lock.json");

	try {
		const content = await fs.readFile(lockPath, "utf-8");
		return JSON.parse(content) as ManifestLock;
	} catch (_error) {
		return null;
	}
}
