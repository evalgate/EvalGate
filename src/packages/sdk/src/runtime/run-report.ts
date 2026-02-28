/**
 * RUNTIME-104: Deterministic Report Serialization (RunReport v1)
 *
 * Stable report format for downstream processing (explain, diff, history).
 * Mirrors CheckReport conventions for consistency.
 */

import type { EnhancedEvalResult, ExecutionErrorEnvelope } from "./types";

/**
 * RunReport schema version - increment when breaking changes occur
 */
export const RUN_REPORT_SCHEMA_VERSION = "1";

/**
 * Main run report structure
 * Mirrors CheckReport conventions for consistency
 */
export interface RunReport {
	/** Schema version for compatibility */
	schemaVersion: string;
	/** Unique run identifier */
	runId: string;
	/** Run start timestamp */
	startedAt: string;
	/** Run completion timestamp */
	finishedAt: string;
	/** Runtime information */
	runtime: {
		/** Runtime ID */
		id: string;
		/** Project namespace */
		namespace: string;
		/** Project root path */
		projectRoot: string;
	};
	/** Execution results (sorted by testId for determinism) */
	results: RunResult[];
	/** Failures and errors (sorted by testId for determinism) */
	failures: RunFailure[];
	/** Execution summary */
	summary: RunSummary;
	/** Execution configuration */
	config: RunConfig;

	/** Serialize to JSON string */
	toJSON(): string;
}

/**
 * Individual test result
 */
export interface RunResult {
	/** Test specification ID */
	testId: string;
	/** Test specification name */
	testName: string;
	/** File path where test is defined */
	filePath: string;
	/** AST position in file */
	position: { line: number; column: number };
	/** Test input */
	input: string;
	/** Pass/fail determination */
	pass: boolean;
	/** Numeric score (0-100) */
	score: number;
	/** Execution duration in milliseconds */
	durationMs: number;
	/** Test metadata */
	metadata?: Record<string, unknown>;
	/** Test tags */
	tags?: string[];
	/** Assertion results if available */
	assertions?: Array<{
		name: string;
		passed: boolean;
		message?: string;
	}>;
}

/**
 * Failure or error information
 */
export interface RunFailure {
	/** Test specification ID */
	testId: string;
	/** Test specification name */
	testName: string;
	/** File path where test is defined */
	filePath: string;
	/** AST position in file */
	position: { line: number; column: number };
	/** Failure classification */
	classification: "failed" | "error" | "timeout";
	/** Error envelope for errors/timeouts */
	errorEnvelope?: ExecutionErrorEnvelope;
	/** Human-readable error message */
	message: string;
	/** Failure timestamp */
	timestamp: string;
}

/**
 * Execution summary statistics
 */
export interface RunSummary {
	/** Total number of tests */
	total: number;
	/** Number of passed tests */
	passed: number;
	/** Number of failed tests */
	failed: number;
	/** Number of errors */
	errors: number;
	/** Number of timeouts */
	timeouts: number;
	/** Overall pass rate (0-100) */
	passRate: number;
	/** Average score (0-100) */
	averageScore: number;
	/** Total execution duration */
	totalDurationMs: number;
	/** Execution success (no errors/timeouts) */
	success: boolean;
}

/**
 * Execution configuration
 */
export interface RunConfig {
	/** Executor type */
	executorType: string;
	/** Maximum parallel workers */
	maxParallel?: number;
	/** Default timeout in milliseconds */
	defaultTimeout: number;
	/** Environment information */
	environment: {
		nodeVersion: string;
		platform: string;
		arch: string;
	};
}

/**
 * RunReport builder for creating deterministic reports
 */
export class RunReportBuilder {
	private report: Partial<RunReport> = {
		schemaVersion: RUN_REPORT_SCHEMA_VERSION,
		results: [],
		failures: [],
		summary: {
			total: 0,
			passed: 0,
			failed: 0,
			errors: 0,
			timeouts: 0,
			passRate: 0,
			averageScore: 0,
			totalDurationMs: 0,
			success: true,
		},
	};

	/**
	 * Initialize report with basic metadata
	 */
	constructor(
		runId: string,
		runtimeInfo: {
			id: string;
			namespace: string;
			projectRoot: string;
		},
	) {
		this.report.startedAt = new Date().toISOString();
		this.report.runId = runId;
		this.report.runtime = runtimeInfo;
	}

	/**
	 * Add a test result to the report
	 */
	addResult(
		testId: string,
		testName: string,
		filePath: string,
		position: { line: number; column: number },
		input: string,
		result: EnhancedEvalResult,
	): void {
		const runResult: RunResult = {
			testId,
			testName,
			filePath,
			position,
			input,
			pass: result.pass,
			score: result.score,
			durationMs: result.durationMs || 0,
			metadata: result.metadata,
			tags: [], // TODO: Extract from spec
			assertions: result.assertions?.map((assertion, index) => ({
				name: assertion.name || `assertion-${index}`,
				passed: assertion.passed,
				message: assertion.message,
			})),
		};

		this.report.results?.push(runResult);

		// Update summary
		this.updateSummary(result);

		// Add to failures if needed
		if (
			!result.pass ||
			result.classification === "error" ||
			result.classification === "timeout"
		) {
			this.addFailure(testId, testName, filePath, position, result);
		}
	}

	/**
	 * Update summary statistics
	 */
	private updateSummary(result: EnhancedEvalResult): void {
		const summary = this.report.summary!;

		summary.total++;
		summary.totalDurationMs += result.durationMs || 0;

		if (result.pass) {
			summary.passed++;
		} else if (result.classification === "error") {
			summary.errors++;
			summary.success = false;
		} else if (result.classification === "timeout") {
			summary.timeouts++;
			summary.success = false;
		} else {
			summary.failed++;
		}

		// Calculate rates and averages
		summary.passRate =
			summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

		// Average score calculation (excluding errors/timeouts)
		const scoredResults = this.report.results?.filter((r) => r.score > 0);
		summary.averageScore =
			scoredResults.length > 0
				? scoredResults.reduce((sum, r) => sum + r.score, 0) /
					scoredResults.length
				: 0;
	}

	/**
	 * Add a failure to the report
	 */
	private addFailure(
		testId: string,
		testName: string,
		filePath: string,
		position: { line: number; column: number },
		result: EnhancedEvalResult,
	): void {
		const failure: RunFailure = {
			testId,
			testName,
			filePath,
			position,
			classification:
				result.classification === "error"
					? "error"
					: result.classification === "timeout"
						? "timeout"
						: "failed",
			errorEnvelope: result.errorEnvelope,
			message: result.error || "Test failed",
			timestamp: new Date().toISOString(),
		};

		this.report.failures?.push(failure);
	}

	/**
	 * Set execution configuration
	 */
	setConfig(config: Partial<RunConfig>): void {
		this.report.config = {
			executorType: "local",
			defaultTimeout: 30000,
			environment: {
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch,
			},
			...config,
		};
	}

	/**
	 * Finalize and return the complete report
	 */
	build(): RunReport {
		// Sort results and failures by testId for determinism
		this.report.results?.sort((a, b) => a.testId.localeCompare(b.testId));
		this.report.failures?.sort((a, b) => a.testId.localeCompare(b.testId));

		// Set completion timestamp
		this.report.finishedAt = new Date().toISOString();

		const finalReport = this.report as RunReport;

		// Add toJSON method
		finalReport.toJSON = () => JSON.stringify(finalReport, null, 2);

		return finalReport;
	}

	/**
	 * Serialize report to JSON string
	 * Ensures deterministic output
	 */
	toJSON(): string {
		const report = this.build();

		return JSON.stringify(report, null, 2);
	}

	/**
	 * Write report to file
	 */
	async writeToFile(filePath: string): Promise<void> {
		const fs = await import("node:fs/promises");
		await fs.writeFile(filePath, this.toJSON(), "utf-8");
	}
}

/**
 * Create a new RunReport builder
 */
export function createRunReport(
	runId: string,
	runtimeInfo: {
		id: string;
		namespace: string;
		projectRoot: string;
	},
): RunReportBuilder {
	return new RunReportBuilder(runId, runtimeInfo);
}

/**
 * Parse a RunReport from JSON string
 */
export function parseRunReport(json: string): RunReport {
	const report = JSON.parse(json) as RunReport;

	// Validate schema version
	if (report.schemaVersion !== RUN_REPORT_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported RunReport schema version: ${report.schemaVersion}`,
		);
	}

	return report;
}
