/**
 * TICKET 1 — evalai discover
 *
 * Your first "holy shit" moment feature
 *
 * Goal:
 * npm install
 * evalai discover
 *
 * Output:
 * Found 42 behavioral specifications
 * Safety: 12
 * Accuracy: 18
 * Agents: 7
 * Tools: 5
 *
 * Why this matters:
 * - makes EvalAI feel alive
 * - proves DSL works
 * - enables intelligence layer
 *
 * This becomes your entry point command.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getExecutionMode } from "../runtime/execution-mode";
import { generateManifest, writeManifest } from "./manifest";

/**
 * Discovered specification statistics
 */
export interface DiscoveryStats {
	/** Total number of specifications found */
	totalSpecs: number;
	/** Specifications by category/tag */
	categories: Record<string, number>;
	/** Specifications by file */
	files: Record<string, number>;
	/** Execution mode information */
	executionMode: {
		mode: string;
		hasSpecRuntime: boolean;
		hasLegacyRuntime: boolean;
		specFiles: string[];
		legacyConfig?: string;
	};
	/** Project metadata */
	project: {
		root: string;
		name: string;
		hasPackageJson: boolean;
		hasGit: boolean;
	};
}

/**
 * Specification analysis result
 */
export interface SpecAnalysis {
	/** Specification ID */
	id: string;
	/** Specification name */
	name: string;
	/** File path */
	file: string;
	/** Tags/categories */
	tags: string[];
	/** Has assertions */
	hasAssertions: boolean;
	/** Uses external models */
	usesModels: boolean;
	/** Uses tools */
	usesTools: boolean;
	/** Estimated complexity */
	complexity: "simple" | "medium" | "complex";
}

/**
 * Discover and analyze behavioral specifications in the current project
 */
export async function discoverSpecs(
	options: { manifest?: boolean } = {},
): Promise<DiscoveryStats> {
	try {
		const projectRoot = process.cwd();
		const executionMode = await getExecutionMode(projectRoot);

		// Get project metadata
		const project = await getProjectMetadata(projectRoot);

		if (executionMode.specFiles.length === 0) {
			console.log("\n✨ No behavioral specifications found.");
			console.log("💡 Create files with defineEval() calls to get started.");
			return {
				totalSpecs: 0,
				categories: {},
				files: {},
				executionMode: {
					mode: executionMode.mode,
					hasSpecRuntime: executionMode.hasSpecRuntime,
					hasLegacyRuntime: executionMode.hasLegacyRuntime,
					specFiles: executionMode.specFiles,
					legacyConfig: executionMode.legacyConfig,
				},
				project,
			};
		}

		// Analyze specifications
		const specs = await analyzeSpecifications(executionMode.specFiles);

		// Generate manifest if requested
		if (options.manifest) {
			console.log("🔧 Generating evaluation manifest...");
			const manifest = await generateManifest(
				specs,
				projectRoot,
				project.name,
				executionMode,
			);
			await writeManifest(manifest, projectRoot);
			console.log(`✅ Manifest written to .evalai/manifest.json`);
			console.log(`✅ Lock file written to .evalai/manifest.lock.json`);
		}

		// Calculate statistics
		const stats = calculateStats(specs, executionMode, project);

		printDiscoveryResults(stats);
		return stats;
	} catch (error) {
		console.error(
			"❌ Discovery failed:",
			error instanceof Error ? error.message : String(error),
		);
		throw error;
	}
}

/**
 * Get project metadata
 */
async function getProjectMetadata(
	projectRoot: string,
): Promise<DiscoveryStats["project"]> {
	const packageJsonPath = path.join(projectRoot, "package.json");
	const gitPath = path.join(projectRoot, ".git");

	let hasPackageJson = false;
	let projectName = "unknown";

	try {
		const packageJson = await fs.readFile(packageJsonPath, "utf-8");
		const parsed = JSON.parse(packageJson);
		hasPackageJson = true;
		projectName = parsed.name || "unknown";
	} catch (_error) {
		// No package.json
	}

	const hasGit = await fs
		.access(gitPath)
		.then(() => true)
		.catch(() => false);

	return {
		root: projectRoot,
		name: projectName,
		hasPackageJson,
		hasGit,
	};
}

/**
 * Analyze specification files
 */
async function analyzeSpecifications(
	specFiles: string[],
): Promise<SpecAnalysis[]> {
	const specs: SpecAnalysis[] = [];

	for (const filePath of specFiles) {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const analysis = analyzeSpecFile(filePath, content);
			specs.push(analysis);
		} catch (error) {
			console.warn(
				`Warning: Could not analyze ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return specs;
}

/**
 * Analyze a single specification file
 */
function analyzeSpecFile(filePath: string, content: string): SpecAnalysis {
	// Extract defineEval calls
	const defineEvalMatches = content.match(/defineEval\s*\([^)]+\)/g) || [];
	const specNames = defineEvalMatches.map((match) => {
		const nameMatch = match.match(/["'`](.+?)["'`](?:\s*,|\s*\))/);
		return nameMatch ? nameMatch[1] : "unnamed";
	});

	// Extract tags
	const tags = extractTags(content);

	// Analyze complexity
	const complexity = analyzeComplexity(content);

	// Check for models and tools
	const usesModels =
		content.includes("model:") ||
		content.includes("model=") ||
		content.includes("openai") ||
		content.includes("anthropic");
	const usesTools =
		content.includes("tool:") ||
		content.includes("function.") ||
		content.includes("call(");

	// Check for assertions
	const hasAssertions =
		content.includes("assert") ||
		content.includes("expect") ||
		content.includes("should");

	// Generate ID from file path
	const id = generateSpecId(filePath);

	return {
		id,
		name: specNames[0] || path.basename(filePath, ".ts"),
		file: path.relative(process.cwd(), filePath),
		tags,
		hasAssertions,
		usesModels,
		usesTools,
		complexity,
	};
}

/**
 * Extract tags from specification content
 */
function extractTags(content: string): string[] {
	const tags: string[] = [];

	// Extract tags parameter
	const tagsMatch = content.match(/tags\s*:\s*\[([^\]]+)\]/);
	if (tagsMatch) {
		const tagContent = tagsMatch[1];
		const tagStrings = tagContent.match(/["'`](.+?)["'`](?:\s*,|\s*)/g) || [];
		tags.push(
			...tagStrings.map((tag) =>
				tag.replace(/["'`](.+?)["'`](?:\s*,|\s*)/, "$1"),
			),
		);
	}

	// Extract from description and metadata
	const descriptionMatch = content.match(
		/description\s*:\s*["'`](.+?)["'`](?:\s*,|\s*)/,
	);
	if (descriptionMatch) {
		const description = descriptionMatch[1].toLowerCase();

		// Auto-categorize based on description
		if (description.includes("safety") || description.includes("security"))
			tags.push("safety");
		if (description.includes("accuracy") || description.includes("precision"))
			tags.push("accuracy");
		if (description.includes("agent") || description.includes("autonomous"))
			tags.push("agents");
		if (description.includes("tool") || description.includes("function"))
			tags.push("tools");
		if (description.includes("latency") || description.includes("speed"))
			tags.push("performance");
		if (description.includes("hallucination") || description.includes("fact"))
			tags.push("factual");
		if (description.includes("bias") || description.includes("fairness"))
			tags.push("bias");
		if (description.includes("privacy") || description.includes("pii"))
			tags.push("privacy");
	}

	return [...new Set(tags)]; // Remove duplicates
}

/**
 * Analyze specification complexity
 */
function analyzeComplexity(content: string): "simple" | "medium" | "complex" {
	const lines = content.split("\n").length;
	const hasAsync = content.includes("async") || content.includes("await");
	const hasLoops = content.includes("for") || content.includes("while");
	const hasConditionals = content.includes("if") || content.includes("switch");
	const hasTryCatch = content.includes("try") || content.includes("catch");
	const hasExternalCalls =
		content.includes("fetch") ||
		content.includes("http") ||
		content.includes("api");

	let complexityScore = 0;

	if (lines > 50) complexityScore += 2;
	if (lines > 100) complexityScore += 3;
	if (hasAsync) complexityScore += 2;
	if (hasLoops) complexityScore += 1;
	if (hasConditionals) complexityScore += 1;
	if (hasTryCatch) complexityScore += 1;
	if (hasExternalCalls) complexityScore += 2;

	if (complexityScore <= 2) return "simple";
	if (complexityScore <= 5) return "medium";
	return "complex";
}

/**
 * Generate specification ID from file path
 */
function generateSpecId(filePath: string): string {
	const relativePath = path.relative(process.cwd(), filePath);
	const hash = Buffer.from(relativePath)
		.toString("base64")
		.replace(/[+/=]/g, "")
		.slice(0, 8);
	return hash;
}

/**
 * Calculate discovery statistics
 */
function calculateStats(
	specs: SpecAnalysis[],
	executionMode: Awaited<ReturnType<typeof getExecutionMode>>,
	project: DiscoveryStats["project"],
): DiscoveryStats {
	const categories: Record<string, number> = {};
	const files: Record<string, number> = {};

	// Count by categories
	for (const spec of specs) {
		for (const tag of spec.tags) {
			categories[tag] = (categories[tag] || 0) + 1;
		}

		// Count by files
		files[spec.file] = (files[spec.file] || 0) + 1;
	}

	// Add default categories if none found
	if (Object.keys(categories).length === 0) {
		categories.general = specs.length;
	}

	return {
		totalSpecs: specs.length,
		categories,
		files,
		executionMode: {
			mode: executionMode.mode,
			hasSpecRuntime: executionMode.hasSpecRuntime,
			hasLegacyRuntime: executionMode.hasLegacyRuntime,
			specFiles: executionMode.specFiles,
			legacyConfig: executionMode.legacyConfig,
		},
		project,
	};
}

/**
 * Print discovery results in a beautiful format
 */
export function printDiscoveryResults(stats: DiscoveryStats): void {
	console.log(`🔍 EvalAI Discovery Results`);
	console.log(``);
	console.log(`📊 Found ${stats.totalSpecs} behavioral specifications`);
	console.log(``);

	// Print categories
	if (Object.keys(stats.categories).length > 0) {
		console.log(`📋 Categories:`);
		const sortedCategories = Object.entries(stats.categories)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10); // Top 10 categories

		for (const [category, count] of sortedCategories) {
			const icon = getCategoryIcon(category);
			console.log(`   ${icon} ${category}: ${count}`);
		}
		console.log(``);
	}

	// Print execution mode
	console.log(`⚙️  Execution Mode: ${stats.executionMode.mode.toUpperCase()}`);
	if (stats.executionMode.hasSpecRuntime) {
		console.log(
			`   ✅ Spec runtime: ${stats.executionMode.specFiles.length} files`,
		);
	}
	if (stats.executionMode.hasLegacyRuntime) {
		console.log(
			`   ✅ Legacy runtime: ${stats.executionMode.legacyConfig ? path.basename(stats.executionMode.legacyConfig!) : "config"}`,
		);
	}
	console.log(``);

	// Print project info
	console.log(`📁 Project: ${stats.project.name}`);
	console.log(`   📍 Root: ${stats.project.root}`);
	console.log(
		`   📦 Package.json: ${stats.project.hasPackageJson ? "✅" : "❌"}`,
	);
	console.log(`   🔄 Git: ${stats.project.hasGit ? "✅" : "❌"}`);
	console.log(``);

	// Print recommendations
	printRecommendations(stats);
}

/**
 * Get icon for category
 */
function getCategoryIcon(category: string): string {
	const icons: Record<string, string> = {
		safety: "🛡️",
		security: "🔒",
		accuracy: "🎯",
		precision: "🎯",
		agents: "🤖",
		autonomous: "🤖",
		tools: "🔧",
		functions: "🔧",
		performance: "⚡",
		latency: "⚡",
		speed: "⚡",
		factual: "📊",
		hallucination: "📊",
		bias: "⚖️",
		fairness: "⚖️",
		privacy: "🔐",
		pii: "🔐",
		general: "📝",
	};

	return icons[category.toLowerCase()] || "📝";
}

/**
 * Print recommendations based on discovery results
 */
function printRecommendations(stats: DiscoveryStats): void {
	console.log(`💡 Recommendations:`);

	if (stats.totalSpecs === 0) {
		console.log(`   🚀 No specifications found. Create your first eval with:
   echo 'import { defineEval } from "@pauly4010/evalai-sdk";
   defineEval("hello-world", async (context) => {
     return { pass: true, score: 100 };
   });' > eval/hello.spec.ts`);
	} else if (stats.totalSpecs < 5) {
		console.log(`   📈 Add more specifications to improve coverage`);
	} else if (stats.totalSpecs < 20) {
		console.log(`   🎯 Good start! Consider organizing by categories`);
	} else {
		console.log(`   🏆 Excellent coverage! Consider running evalai run`);
	}

	if (
		!stats.executionMode.hasSpecRuntime &&
		!stats.executionMode.hasLegacyRuntime
	) {
		console.log(`   🆕 New project? Try 'evalai init' to get started`);
	}

	if (
		stats.executionMode.hasLegacyRuntime &&
		!stats.executionMode.hasSpecRuntime
	) {
		console.log(
			`   🔄 Legacy project detected. Try 'evalai migrate config' to upgrade`,
		);
	}

	if (stats.executionMode.hasSpecRuntime) {
		console.log(
			`   🚀 Ready to run! Use 'evalai run' to execute specifications`,
		);
	}

	console.log(``);
}

/**
 * Run discovery command
 */
export async function runDiscover(): Promise<void> {
	try {
		const stats = await discoverSpecs();
		printDiscoveryResults(stats);
		process.exit(0);
	} catch (error) {
		console.error(
			`❌ Discovery failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}
