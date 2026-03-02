#!/usr/bin/env tsx

/**
 * EvalGate Golden Path Demo
 *
 * Runs all 7 steps of the canonical evaluation loop using real library modules.
 * No mocks, no external APIs, no database required.
 *
 * Usage:
 *   pnpm tsx scripts/golden-path-demo.ts
 *
 * Steps:
 *   1. Trace arrives (simulated SDK payload)
 *   2. Freeze (with redaction)
 *   3. Failure detection
 *   4. Test case generation → quarantine
 *   5. PR annotation payload (GitHub Check Run)
 *   6. Replay plan
 *   7. Dataset health snapshot
 */

import {
	buildCheckRunPayload,
	buildPRCommentBody,
} from "../src/lib/ci/github-pr-annotations";
import {
	analyzeDatasetHealth,
	computeDatasetTrend,
	type DatasetEntry,
} from "../src/lib/dataset/health-analyzer";
import { detectRuleBased } from "../src/lib/failures/detectors/rule-based";
import { buildReplayPlan } from "../src/lib/replay/replay-runner";
import {
	createGeneratedTestCase,
	getGatingCases,
	promoteTestCase,
	quarantineTestCase,
} from "../src/lib/testcases/quarantine";
import { freezeTrace } from "../src/lib/traces/trace-freezer";
import { validateTraceUpload } from "../src/lib/traces/trace-validator";

// ── Helpers ───────────────────────────────────────────────────────────────────

function step(n: number, title: string) {
	console.log(`\n${"─".repeat(60)}`);
	console.log(`Step ${n}: ${title}`);
	console.log("─".repeat(60));
}

function ok(msg: string) {
	console.log(`  ✓  ${msg}`);
}

function info(label: string, value: unknown) {
	const str =
		typeof value === "string" ? value : JSON.stringify(value, null, 2);
	const indented = str
		.split("\n")
		.map((l) => `     ${l}`)
		.join("\n");
	console.log(`  ↳  ${label}:\n${indented}`);
}

// ── Step 1: SDK payload arrives ───────────────────────────────────────────────

step(1, "Trace arrives via SDK");

const sdkPayload = {
	specVersion: 1,
	traceId: "demo-trace-001",
	name: "Summarize customer complaint",
	status: "success" as const,
	durationMs: 1840,
	environment: {
		sdkName: "evalgate-ts",
		sdkVersion: "1.0.0",
		deployEnvironment: "production",
		commitSha: "abc1234",
	},
};

const validation = validateTraceUpload(sdkPayload);
if (!validation.ok) {
	console.error("Validation failed:", validation.error);
	process.exit(1);
}
ok(`Payload validated — specVersion: ${validation.data.specVersion}`);
ok(`traceId: ${validation.data.traceId}`);

// ── Step 2: Freeze with redaction ─────────────────────────────────────────────

step(2, "Freeze trace (redaction on by default)");

const traceForFreezing = {
	traceId: sdkPayload.traceId,
	spans: [
		{
			spanId: "span-llm-1",
			name: "llm-call",
			type: "llm",
			durationMs: 1240,
			metadata: { model: "gpt-4o", provider: "openai", temperature: 0.7 },
			behavioral: {
				messages: [
					{ role: "system" as const, content: "You are a helpful assistant." },
					{ role: "user" as const, content: "Summarize this complaint." },
					{
						role: "assistant" as const,
						content: "I cannot determine the root cause.",
					},
				],
				toolCalls: [
					{
						name: "lookup_policy",
						arguments: { policyId: "P-123" },
						output: { policy: "Standard refund policy applies." },
						success: true,
					},
				],
			},
		},
		{
			spanId: "span-llm-2",
			name: "llm-followup",
			type: "llm",
			durationMs: 600,
			metadata: { model: "gpt-4o", provider: "openai", temperature: 0.7 },
			behavioral: {
				messages: [
					{
						role: "assistant" as const,
						content: "I'm sorry, I cannot help with that.",
					},
				],
			},
		},
	],
	environment: sdkPayload.environment,
};

const snapshot = freezeTrace(traceForFreezing, {
	commitSha: sdkPayload.environment.commitSha,
	redactionProfileId: "default",
});

ok(`Frozen at: ${snapshot.frozenAt}`);
ok(
	`Redacted: ${snapshot.redacted} (profile: ${snapshot.redactionProfileId ?? "none"})`,
);
ok(`Replay tier: ${snapshot.replayTier}`);
ok(`Spans captured: ${snapshot.spans.length}`);

// ── Step 3: Failure detection ─────────────────────────────────────────────────

step(3, "Failure detection (rule-based)");

const allOutput = snapshot.spans
	.flatMap((s) => s.messages.map((m) => m.content))
	.join(" ");

const failures = detectRuleBased({ output: allOutput });

if (failures.length > 0) {
	for (const f of failures) {
		ok(
			`Detected: ${f.category} (rawConfidence: ${f.rawConfidence.toFixed(2)})`,
		);
		if (f.evidence) info("evidence", f.evidence);
	}
} else {
	ok("No failures detected");
}

const primaryFailure = failures[0];

// ── Step 4: Generate test case → quarantine → promote ────────────────────────

step(4, "Test case generated → quarantine → human promotion");

const generated = createGeneratedTestCase({
	id: `tc-${snapshot.traceId}`,
	payload: {
		prompt: "Summarize this complaint.",
		expectedOutput: "A helpful, actionable summary.",
		sourceTraceId: snapshot.traceId,
		failureCategory: primaryFailure?.category ?? "unknown",
	},
	generatedBy: "trace-generator-v1",
	qualityScore: 0.82,
	tags: ["summarization", "refusal"],
});
ok(`Generated test case: ${generated.id} (status: ${generated.status})`);

const quarantined = quarantineTestCase(generated, {
	actor: "system",
	reason: "Auto-quarantine after failure",
});
if (quarantined.success) ok(`Quarantined: ${quarantined.testCase.status}`);

const promoted = promoteTestCase(
	quarantined.success ? quarantined.testCase : generated,
	{
		actor: "engineer@example.com",
		reason: "Confirmed regression — add to gating suite",
		minQualityScore: 0.7,
	},
);
if (promoted.success) {
	ok(`Promoted by: ${promoted.testCase.auditTrail.at(-1)?.actor}`);
	ok(`Gating cases: ${getGatingCases([promoted.testCase]).length}`);
}

// ── Step 5: PR annotation payload ────────────────────────────────────────────

step(5, "GitHub PR annotation payload");

const evalSummary = {
	runId: "run-demo-001",
	evaluationName: "Customer Support Suite",
	totalTests: 15,
	passed: 12,
	failed: 3,
	skipped: 0,
	overallScore: 0.74,
	completedAt: new Date().toISOString(),
	results: [],
	baselineScore: 0.8,
	scoreDelta: -0.06,
};

const checkRun = buildCheckRunPayload(
	evalSummary,
	sdkPayload.environment.commitSha,
	{ passThreshold: 0.9 },
);

ok(`Check run conclusion: ${checkRun.conclusion}`);
ok(`Title: ${checkRun.output.title}`);

const prComment = buildPRCommentBody(evalSummary, { passThreshold: 0.9 });
ok(
	`PR comment preview (first 120 chars): ${prComment.slice(0, 120).replace(/\n/g, " ")}...`,
);

// ── Step 6: Replay plan ───────────────────────────────────────────────────────

step(6, "Replay plan");

const replayJob = {
	jobId: "replay-job-001",
	startedAt: new Date().toISOString(),
	snapshots: [
		{
			traceId: snapshot.traceId,
			commitSha: snapshot.commitSha,
			toolOutputCaptureMode: snapshot.toolOutputCaptureMode,
			externalDeps: snapshot.externalDeps.map((d) => ({
				captured: d.captured,
				type: d.type,
			})),
			modelConfig: {
				model: snapshot.modelConfig.model,
				temperature: snapshot.modelConfig.temperature,
			},
			spans: snapshot.spans.map((s) => ({
				toolCalls: s.toolCalls.map((tc) => ({ captureMode: tc.captureMode })),
			})),
			originalScore: 0.74,
			originalPassed: false,
			capturedInput: { prompt: "Summarize this complaint." },
			capturedAt: snapshot.frozenAt,
			tags: ["summarization", "refusal"],
		},
	],
	minTier: "C" as const,
};

const plan = buildReplayPlan(replayJob);
ok(
	`Replay plan: ${plan.totalSnapshots} snapshot(s), ${plan.plannedReplays.length} planned, ${plan.skippedCount} skipped`,
);
ok(`Has blockers: ${plan.hasBlockers}`);

// ── Step 7: Dataset health snapshot ──────────────────────────────────────────

step(7, "Dataset health over time");

function makeEntry(id: string, input: string, score: number): DatasetEntry {
	return { id, input, expectedOutput: "OK", lastScore: score };
}

const prevEntries: DatasetEntry[] = [
	makeEntry("e1", "What is 2+2?", 0.95),
	makeEntry("e2", "Summarize this article.", 0.9),
	makeEntry("e3", "Translate to Spanish.", 0.88),
	makeEntry("e4", "Summarize this article.", 0.9), // near-duplicate
];

const currEntries: DatasetEntry[] = [
	makeEntry("e1", "What is 2+2?", 0.82),
	makeEntry("e2", "Summarize this article.", 0.74),
	makeEntry("e3", "Translate to Spanish.", 0.71),
	makeEntry("e4", "Summarize this article.", 0.74),
];

const prevReport = analyzeDatasetHealth(prevEntries);
const currReport = analyzeDatasetHealth(currEntries);
const trend = computeDatasetTrend(prevReport, currReport);

ok(`Health score (prev): ${(prevReport.healthScore * 100).toFixed(0)}/100`);
ok(`Health score (curr): ${(currReport.healthScore * 100).toFixed(0)}/100`);
ok(`Score trend: ${trend.scoreTrend} (Δ${trend.meanScoreDelta.toFixed(3)})`);
ok(`Duplicates detected: ${currReport.duplicates.length}`);
ok(`Outliers detected: ${currReport.outliers.length}`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log("  EvalGate Golden Path — COMPLETE");
console.log(`${"═".repeat(60)}`);
console.log("  All 7 steps executed with zero mocks, zero DB, zero network.");
console.log(
	"  The loop: SDK → freeze → detect → quarantine → PR gate → replay → health.",
);
console.log(`${"═".repeat(60)}\n`);
