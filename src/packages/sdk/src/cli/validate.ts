/**
 * evalgate validate — static validation of spec files without execution
 *
 * The equivalent of `tsc --noEmit` for eval specs. Catches:
 * - Missing or malformed defineEval calls
 * - Executor functions that don't return EvalResult shape
 * - Invalid spec names (characters, length)
 * - Empty spec files
 * - Missing required fields in config-form defineEval
 *
 * Usage:
 *   evalgate validate
 *   evalgate validate --format json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getExecutionMode } from "../runtime/execution-mode";

export interface ValidationIssue {
	/** Severity: error blocks CI, warn is informational */
	severity: "error" | "warn";
	/** File where the issue was found */
	file: string;
	/** Line number (1-indexed), if available */
	line?: number;
	/** Short error code */
	code: string;
	/** Human-readable message */
	message: string;
}

export interface ValidateResult {
	/** Total spec files scanned */
	filesScanned: number;
	/** Spec files with issues */
	filesWithIssues: number;
	/** All issues found */
	issues: ValidationIssue[];
	/** Whether validation passed (no errors; warnings are OK) */
	passed: boolean;
}

/**
 * Name validation regex — must match the runtime's validateSpecName
 */
const VALID_NAME_RE = /^[a-zA-Z0-9\s\-_]+$/;
const MAX_NAME_LENGTH = 100;

/**
 * Static patterns we look for in spec files
 */
const DEFINE_EVAL_RE = /defineEval\s*[.(]/g;
const DEFINE_EVAL_NAME_RE = /defineEval\s*\(\s*["'`]([^"'`]*)["'`]/g;
const DEFINE_EVAL_CONFIG_RE = /defineEval\s*\(\s*\{/g;
const DEFINE_EVAL_SKIP_RE = /defineEval\.skip\s*\(/g;
const DEFINE_EVAL_ONLY_RE = /defineEval\.only\s*\(/g;
const DEFINE_EVAL_FROM_DATASET_RE = /defineEval\.fromDataset\s*\(/g;
const EXECUTOR_RETURN_RE = /return\s*\{[^}]*pass\s*:/g;
const CREATE_RESULT_RE = /createResult\s*\(/g;

function analyzeFile(filePath: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const relPath = path.relative(process.cwd(), filePath);

	let content: string;
	try {
		content = fs.readFileSync(filePath, "utf8");
	} catch {
		issues.push({
			severity: "error",
			file: relPath,
			code: "FILE_UNREADABLE",
			message: `Cannot read file: ${relPath}`,
		});
		return issues;
	}

	if (content.trim().length === 0) {
		issues.push({
			severity: "error",
			file: relPath,
			code: "EMPTY_FILE",
			message: "Spec file is empty",
		});
		return issues;
	}

	const lines = content.split("\n");

	// Check for defineEval calls
	const defineEvalMatches = content.match(DEFINE_EVAL_RE);
	const skipMatches = content.match(DEFINE_EVAL_SKIP_RE);
	const onlyMatches = content.match(DEFINE_EVAL_ONLY_RE);
	const fromDatasetMatches = content.match(DEFINE_EVAL_FROM_DATASET_RE);

	const totalCalls =
		(defineEvalMatches?.length ?? 0) +
		(skipMatches?.length ?? 0) +
		(onlyMatches?.length ?? 0) +
		(fromDatasetMatches?.length ?? 0);

	if (totalCalls === 0) {
		issues.push({
			severity: "warn",
			file: relPath,
			code: "NO_DEFINE_EVAL",
			message:
				"No defineEval() calls found. File may not define any specs.",
		});
	}

	// Validate spec names
	const nameMatches = [...content.matchAll(DEFINE_EVAL_NAME_RE)];
	for (const match of nameMatches) {
		const name = match[1];
		const matchIndex = match.index ?? 0;
		const lineNum =
			content.substring(0, matchIndex).split("\n").length;

		if (!name || name.trim() === "") {
			issues.push({
				severity: "error",
				file: relPath,
				line: lineNum,
				code: "EMPTY_NAME",
				message: "Spec name is empty",
			});
			continue;
		}

		if (name.length > MAX_NAME_LENGTH) {
			issues.push({
				severity: "error",
				file: relPath,
				line: lineNum,
				code: "NAME_TOO_LONG",
				message: `Spec name "${name.slice(0, 30)}..." exceeds ${MAX_NAME_LENGTH} characters`,
			});
		}

		if (!VALID_NAME_RE.test(name)) {
			issues.push({
				severity: "error",
				file: relPath,
				line: lineNum,
				code: "INVALID_NAME",
				message: `Spec name "${name}" contains invalid characters (only letters, numbers, spaces, hyphens, underscores allowed)`,
			});
		}
	}

	// Check config-form defineEval calls have required fields
	const configMatches = [...content.matchAll(DEFINE_EVAL_CONFIG_RE)];
	for (const match of configMatches) {
		const matchIndex = match.index ?? 0;
		const lineNum =
			content.substring(0, matchIndex).split("\n").length;

		// Simple heuristic: look for 'name:' and 'executor:' in the next ~20 lines
		const contextLines = lines.slice(lineNum - 1, lineNum + 19).join("\n");
		if (!contextLines.includes("name:") && !contextLines.includes("name :")) {
			issues.push({
				severity: "error",
				file: relPath,
				line: lineNum,
				code: "MISSING_NAME",
				message: "Config-form defineEval() missing required 'name' field",
			});
		}
		if (
			!contextLines.includes("executor:") &&
			!contextLines.includes("executor :")
		) {
			issues.push({
				severity: "error",
				file: relPath,
				line: lineNum,
				code: "MISSING_EXECUTOR",
				message:
					"Config-form defineEval() missing required 'executor' field",
			});
		}
	}

	// Check that executors return EvalResult shape
	const hasCreateResult = CREATE_RESULT_RE.test(content);
	const hasReturnPass = EXECUTOR_RETURN_RE.test(content);
	if (totalCalls > 0 && !hasCreateResult && !hasReturnPass) {
		issues.push({
			severity: "warn",
			file: relPath,
			code: "NO_RESULT_SHAPE",
			message:
				"No createResult() or return { pass: ... } found. Executors may not return the required EvalResult shape.",
		});
	}

	return issues;
}

export async function runValidate(
	args: string[] = [],
): Promise<ValidateResult> {
	const formatIndex = args.indexOf("--format");
	const format =
		formatIndex !== -1 ? (args[formatIndex + 1] as "human" | "json") : "human";

	const projectRoot = process.cwd();
	const executionMode = await getExecutionMode(projectRoot);
	const specFiles = executionMode.specFiles;

	if (specFiles.length === 0) {
		const result: ValidateResult = {
			filesScanned: 0,
			filesWithIssues: 0,
			issues: [],
			passed: true,
		};
		if (format === "json") {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log("\n✨ No spec files found. Nothing to validate.");
			console.log("💡 Create files with defineEval() calls to get started.");
		}
		return result;
	}

	const allIssues: ValidationIssue[] = [];
	const filesWithIssues = new Set<string>();

	for (const file of specFiles) {
		const issues = analyzeFile(file);
		for (const issue of issues) {
			allIssues.push(issue);
			filesWithIssues.add(issue.file);
		}
	}

	const errors = allIssues.filter((i) => i.severity === "error");
	const warnings = allIssues.filter((i) => i.severity === "warn");
	const passed = errors.length === 0;

	const result: ValidateResult = {
		filesScanned: specFiles.length,
		filesWithIssues: filesWithIssues.size,
		issues: allIssues,
		passed,
	};

	if (format === "json") {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			`\n🔍 Validated ${specFiles.length} spec file${specFiles.length === 1 ? "" : "s"}`,
		);

		if (allIssues.length === 0) {
			console.log("✅ All spec files are valid.\n");
		} else {
			for (const issue of allIssues) {
				const loc = issue.line ? `:${issue.line}` : "";
				const icon = issue.severity === "error" ? "❌" : "⚠️";
				console.log(
					`  ${icon} ${issue.file}${loc} [${issue.code}] ${issue.message}`,
				);
			}
			console.log(
				`\n${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
			);

			if (passed) {
				console.log("✅ Validation passed (warnings only).\n");
			} else {
				console.log("❌ Validation failed.\n");
			}
		}
	}

	return result;
}
