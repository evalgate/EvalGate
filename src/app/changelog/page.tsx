"use client";

import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SectionTitle = "Breaking" | "Added" | "Fixed" | "Changed";
type PackageTag = "TypeScript" | "Python" | "Platform";
type ReleaseType = "feature" | "fix" | "breaking";

type Section = { title: SectionTitle; items: string[] };

type VersionEntry = {
	version: string;
	date: string;
	packages: PackageTag[];
	type: ReleaseType;
	sections: Section[];
};

const packageStyles: Record<PackageTag, string> = {
	TypeScript:
		"bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
	Python:
		"bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
	Platform:
		"bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
};

const sectionStyles: Record<SectionTitle, string> = {
	Breaking: "text-red-600 dark:text-red-400",
	Added: "text-green-600 dark:text-green-400",
	Fixed: "text-blue-600 dark:text-blue-400",
	Changed: "text-orange-600 dark:text-orange-400",
};

const typeStyles: Record<ReleaseType, string> = {
	feature:
		"bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
	fix: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
	breaking: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
};

const typeLabel: Record<ReleaseType, string> = {
	feature: "Feature",
	fix: "Bugfix",
	breaking: "Breaking",
};

const versions: VersionEntry[] = [
	{
		version: "3.0.2",
		date: "2026-03-09",
		packages: ["TypeScript", "Python"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"judge-credibility.ts — TPR/TNR computation with bias-corrected pass rate θ̂ = (p_obs + TNR − 1) / (TPR + TNR − 1), clipped to [0, 1]",
					"Bootstrap CI with deterministic seed (default: 42, configurable via judge.bootstrapSeed)",
					"Graceful degradation — skip correction when discriminative power ≤ 0.05; skip CI when n < 30; both emit correctionSkippedReason / ciSkippedReason into judgeCredibility report block",
					"Gate exit 8 (WARN) when correction is skipped but thresholds are configured",
					"evalgate diff flags apples-to-oranges comparison when correction basis differs between runs",
					"judgeTprMin, judgeTnrMin, judgeMinLabeledSamples — new check args with gate enforcement",
					"Doctor checks for weak judge and low sample-count alignment warnings",
					"Train/dev/test split policy enforcement to prevent prompt/eval set contamination",
					"evalgate label — interactive per-trace CLI: numbered failure-mode menu, resume support, undo (u), progress indicator, session summary",
					"evalgate analyze — reads labeled JSONL, outputs per-mode frequency report",
					"evalgate failure-modes — structured CLI to define 5–10 named binary failure modes with pass/fail criteria",
					"Canonical labeled dataset schema — .evalgate/golden/labeled.jsonl with fields: caseId, input, expected, actual, label, failureMode, labeledAt",
					"evalgate.md — unified human-maintained intent document initialized by evalgate init, consumed by CLI and judge as context",
					"Per-failure-mode frequency map added to run results summary",
					"Frequency × impact prioritization added to evalgate explain output",
					"failureModeAlerts config — per-mode impact weights + alert thresholds (count-based and percent-based), global thresholds",
					"withCostTier() method — cost-tier labeling on assertions; code vs llm tags",
					"Normalized eval budget — trace-count mode ships now; Stripe LLM billing stubbed behind CostProvider interface",
					"evaluateReplayOutcome() — compares corrected pass rates first, falls back to raw; emits keep/discard with comparisonBasis field",
					"evalgate replay-decision — --previous/--current run comparison command",
					"Golden set health in evalgate doctor — label coverage, class balance, last refresh date; stale/imbalanced warnings",
					"Partial results saved on budget exceeded before exit",
					"evalgate explain spec vs generalization classification — SPECIFICATION GAP vs GENERALIZATION FAILURE",
					"docs/zero-to-golden-30-minutes.md — 5-step onboarding guide: init → discover+run → label → analyze → ci",
					"docs/report-trace.md — asymmetric sampling model with all three modes and negative-feedback bypass behavior",
					"docs/replay.md — distinguishes evalgate replay (candidate) from evalgate replay-decision (run comparison)",
				],
			},
		],
	},
	{
		version: "3.0.1",
		date: "2026-03-06",
		packages: ["TypeScript", "Python"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"Lazy-load CLI imports — extracted PROFILES to cli/profiles.py to prevent typer crash when SDK imported without CLI extras",
					"API key guard — Python AIEvalClient.__init__ now raises EvalGateError immediately instead of failing later with confusing 401",
					"Dead documentation URLs — replaced all ai-eval-platform.com URLs with evalgate.com in both SDKs",
					"Stale package names — replaced @ai-eval-platform/sdk with @evalgate/sdk in all JSDoc examples",
					"Consolidated assert_passes_gate — single definition in matchers.py with message param; pytest_plugin.py delegates to it",
					"Renamed EvalAIConfig → EvalGateConfig with deprecated alias for backward compatibility",
					"Added api_key property to Python AIEvalClient matching TypeScript SDK",
					"Test file exclusion — added explicit !dist/**/*.test.js patterns to package.json files array",
					"Documented aliases — added JSDoc for ContextManager → EvalContext and saveSnapshot → snapshot() aliases",
					"Dict-style access — added __class_getitem__ to GATE_EXIT class for GATE_EXIT['PASS'] syntax",
				],
			},
		],
	},
	{
		version: "3.0.0",
		date: "2026-03-04",
		packages: ["TypeScript", "Python", "Platform"],
		type: "breaking",
		sections: [
			{
				title: "Breaking",
				items: [
					"Major version bump — EvalGate is now AI quality infrastructure. Production failures automatically become regression tests. No breaking changes to existing SDK exports or CLI commands.",
				],
			},
			{
				title: "Added",
				items: [
					"AI Reliability Loop — full production-to-CI pipeline: collect traces → detect failures → group by hash → generate test cases → score quality → auto-promote to golden dataset → gate in CI",
					"POST /api/collector — single-payload trace + spans ingest endpoint (LangWatch-compatible schema) with idempotent ON CONFLICT DO NOTHING",
					"Failure detection pipeline — trace_failure_analysis async job: detect → aggregate → group (SHA-256) → generate → score → auto-promote",
					"Auto-promotion heuristic — candidates with quality ≥ 90, confidence ≥ 0.8, and detectors ≥ 2 auto-promoted to golden regression suite",
					"Golden regression dataset — first-class evaluation type per org, auto-created on first promote",
					"Candidate eval cases — quarantined test case candidates with full lifecycle: quarantined → approved → promoted",
					"User feedback endpoint — POST /api/traces/:id/feedback with thumbs-down triggering analysis",
					"SDK reportTrace() — lightweight single-call trace reporting with client-side sampling",
					"evalgate promote — CLI command to promote candidates (--auto for bulk, --list to view)",
					"evalgate replay — CLI command to replay candidate against current model",
					"Rate-limit guardrail — sliding-window rate limiter (200/min per org) prevents traffic spikes from overwhelming analysis",
					"analysis_status on traces — pending → analyzing → analyzed → failed lifecycle tracking",
					"source + environment columns — first-class trace metadata (sdk/api/cli, production/staging/dev)",
					"Dedup against existing tests — prevents near-duplicates in golden dataset via input hash + title match",
					"88 new tests (70 unit + 18 DB) covering collector, sampling, rate limiter, pipeline, CLI, and schema",
				],
			},
		],
	},
	{
		version: "2.2.2",
		date: "2026-03-03",
		packages: ["TypeScript", "Python"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"8 stub assertions replaced with real implementations: hasSentiment (34/31-word lexicon + substring matching), hasNoToxicity (~80 terms, 9 categories), hasValidCodeSyntax (bracket/brace/paren balance with string & comment awareness), containsLanguage (12 languages + BCP-47 subtag support), hasFactualAccuracy & hasNoHallucinations (case-insensitive), hasReadabilityScore (per-word syllable fix), matchesSchema (JSON Schema required array + properties object dispatch)",
					"matchesSchema regression — { type: 'object', required: ['name'] } now correctly checks required keys exist in value (was returning false)",
					"importData crash — options parameter now defaults to {} to prevent TypeError when called as importData(client, data)",
					"compareWithSnapshot object coercion — accepts unknown input; coerces via JSON.stringify before comparison",
					"WorkflowTracer crash without API key — typeof guard on client.getOrganizationId prevents crash with partial/mock clients",
					"Python SDK _version.py synced to 2.2.2 (was stale at 2.1.2); pyproject.toml and README updated",
				],
			},
			{
				title: "Added",
				items: [
					"6 LLM-backed async assertion variants (TypeScript): hasSentimentAsync, hasNoToxicityAsync, containsLanguageAsync, hasValidCodeSyntaxAsync, hasFactualAccuracyAsync, hasNoHallucinationsAsync — use OpenAI or Anthropic for context-aware semantic evaluation",
					"configureAssertions(config) / getAssertionConfig() — global AssertionLLMConfig; all *Async functions pick it up automatically, or accept per-call override",
					"AssertionLLMConfig type — { provider: 'openai' | 'anthropic'; apiKey: string; model?: string; baseUrl?: string }",
					"JSDoc **Fast and approximate** / **Slow and accurate** markers on all sync/async pairs with {​@link xAsync} IDE tooltip cross-references",
					"EvaluationTemplates JSDoc — clarifies these are string identifiers for API calls, not template definition objects",
					"115 new tests in assertions.test.ts (sync lexicons, JSON Schema formats, bracket edge cases, 12-language BCP-47, all 6 async variants with OpenAI + Anthropic mocked paths, error cases)",
				],
			},
		],
	},
	{
		version: "2.2.1",
		date: "2026-03-03",
		packages: ["TypeScript", "Python"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"snapshot(name, output) accepts objects — non-string values auto-serialized via JSON.stringify; SnapshotManager.save() and update() widened to output: unknown",
					"Python SDK version bump to 2.2.1 in pyproject.toml",
				],
			},
		],
	},
	{
		version: "2.2.0",
		date: "2026-03-03",
		packages: ["TypeScript", "Python", "Platform"],
		type: "feature",
		sections: [
			{
				title: "Breaking",
				items: [
					"snapshot(output, name) → snapshot(name, output) — parameter order swapped to match natural call convention. Update existing snapshot(output, 'label') calls to snapshot('label', output)",
				],
			},
			{
				title: "Added",
				items: [
					"expect().not modifier — proxy-based negation for any chained assertion: expect(x).not.toContain(y)",
					"hasPII(text) — semantic alias for PII detection; true = PII found. Eliminates double-negative confusion with notContainsPII",
					"defineSuite object form — accepts both defineSuite(name, [...fns]) and defineSuite({ name, specs: [...fns] })",
				],
			},
			{
				title: "Fixed",
				items: [
					"specId collision — all specs in eval/ shared the same 8-char ID; SHA-256 hex (16 chars) fix in discover.ts",
					"explain UNKNOWN verdict — correctly reads .evalgate/last-run.json RunResult format; shows PASS/FAIL instead of UNKNOWN",
					"print-config baseUrl default — was http://localhost:3000; now https://api.evalgate.com",
					"baseline update self-contained — no longer requires a custom eval:baseline-update npm script",
					"notContainsPII phone regex — covers 555-123-4567, 555.123.4567, and 555 123 4567 formats",
					"impact-analysis git error — clean targeted messages instead of raw git --help wall-of-text",
				],
			},
		],
	},
	{
		version: "2.1.3",
		date: "2026-03-02",
		packages: ["TypeScript", "Platform"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"Critical: Multi-defineEval calls per file — only the first was discovered (silent data loss); all specs now registered",
					"Critical: Simulated executeSpec replaced with real spec execution",
					"High: First-run gate false regression on fresh init when no test script exists",
					"High: Doctor defaults baseUrl to localhost:3000 instead of production API",
					"High: Run scores now include scoring model context for clarity",
					"Low: explain no longer shows 'unnamed' for builtin gate failures",
					"Docs: Added missing discover --manifest step to local quickstart",
					"Platform: Updated stability docs, OpenAPI changelog, and version synchronization",
				],
			},
		],
	},
	{
		version: "2.1.2",
		date: "2026-03-02",
		packages: ["TypeScript", "Python", "Platform"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"Type safety — resolved 150+ type errors across API routes, services, and components; zero TypeScript errors codebase-wide",
					"Test suite — all three test lanes green (unit, DB, DOM); fixtures updated to align with corrected data handling",
					"CI gate — lint, build, regression gate, and all audits passing locally",
					"Python SDK — contract payload validation fixed; ruff errors in test suite resolved",
					"SDK-Server integration — 3 critical validation mismatches between SDK and server fixed",
					"Test database regression — DB test failures after recent schema changes resolved",
				],
			},
			{
				title: "Added",
				items: [
					"Comprehensive test coverage: evaluation templates (15 tests), export templates (18), scoring algorithms (35), run assertions (15), HMAC signing (13), SDK mapper/transformer (55)",
					"Version resolution APIs — resolveAtVersion, resolveAtTime, buildVersionHistory",
					"Test case lifecycle — Quarantine → promote workflow for generated test cases",
					"Redaction pipeline — PII redaction integrated into trace freezing",
					"Contract payload suite — cross-language test matrix (TypeScript + Python SDK)",
				],
			},
		],
	},
	{
		version: "2.1.1",
		date: "2026-03-02",
		packages: ["TypeScript", "Python", "Platform"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"Variable name mismatch in trace processing pipeline",
					"CI contract payload validation — ruff errors in Python SDK test suite",
					"SDK-Server integration — 3 critical validation mismatches between SDK and server",
					"Test database regression — DB test failures after recent schema changes",
				],
			},
			{
				title: "Added",
				items: [
					"Golden path demo — single-command script demonstrating end-to-end evaluation workflow",
					"Feature extraction caching — performance optimization for embedding-based coverage models",
				],
			},
		],
	},
	{
		version: "2.1.0",
		date: "2026-03-02",
		packages: ["TypeScript", "Platform"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"EvalGate Intelligence Layer — 32 new backend modules, 505 unit tests",
					"Trace Intelligence: trace-schema (Zod v1 + version compat), trace-validator, trace-freezer (structural immutability)",
					"Failure Detection: taxonomy (8 categories), confidence (weighted multi-detector), rule-based detectors",
					"Test Generation: trace-minimizer, generator (EvalCase from traces), deduplicator (Jaccard clustering), test-quality-evaluator",
					"Dataset Coverage: coverage-model with gap detection, cluster coverage ratio, configurable seedPhrases",
					"Three-Layer Scoring: reasoning-layer, action-layer, outcome-layer each with evidenceAvailable flag",
					"Multi-Judge: aggregation (6 strategies — median/mean/weighted/majority/min/max), transparency (per-judge audit trail)",
					"Metric DAG Safety: cycle detection, missing finalScore node, max depth (10), reachability check",
					"Behavioral Drift: 6 signal types; drift-explainer with human-readable narratives",
					"Replay Determinism: SHA-256 input canonicalization; Regression Attribution: ranked cause scoring",
					"5 UX components: ScoreLayerBreakdown, JudgeVotePanel, DriftSeverityBadge, CoverageGapList, FailureConfidenceBadge (40 DOM tests)",
					"EvalCase ID upgraded from 32-bit FNV-1a (8 hex) to 64-bit FNV-1a (16 hex) — format: ec_<16 hex>",
				],
			},
			{
				title: "Fixed",
				items: [
					"Refusal constraint regex — replaced PCRE-only (?i) inline flag with character classes; no more SyntaxError in JS runtimes",
					"majority_vote aggregation tie — pass == fail now returns finalScore: 0.5 instead of silently returning 1.0",
				],
			},
		],
	},
	{
		version: "2.0.0",
		date: "2026-03-01",
		packages: ["TypeScript", "Python", "Platform"],
		type: "breaking",
		sections: [
			{
				title: "Breaking",
				items: [
					"npm package renamed: @pauly4010/evalai-sdk → @evalgate/sdk",
					"PyPI package renamed: pauly4010-evalai-sdk → pauly4010-evalgate-sdk",
					"CLI command renamed: evalai → evalgate",
					"Config directory: .evalai/ → .evalgate/ (legacy still read with deprecation warning)",
					"Environment variables: EVALAI_* → EVALGATE_* (legacy still work with deprecation warning)",
					"Error class: EvalAIError → EvalGateError",
					"HTTP headers: X-EvalAI-* → X-EvalGate-*",
				],
			},
			{
				title: "Added",
				items: [
					"Deprecation warnings on legacy env vars (EVALAI_API_KEY), config paths (.evalai/), and old package imports",
					"Python SDK 2.0.0 — full parity with TypeScript SDK; pauly4010-evalgate-sdk on PyPI",
				],
			},
		],
	},
	{
		version: "1.9.0",
		date: "2026-02-27",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate ci — one-command CI pipeline: discover → manifest → impact → run → diff → PR summary → next step",
					"Durable run history — timestamped artifacts in .evalgate/runs/run-<runId>.json; index.json tracks all runs",
					"Smart diffing — classifies regressions, improvements, added/removed specs with GitHub Step Summary integration",
					"--impacted-only flag — runs only specs impacted by git changes (impact analysis integration)",
					"Centralized architecture — resolveEvalWorkspace(), isCI(), isGitHubActions() unified across all commands",
					"Self-documenting failures — always prints copy/paste next step for any failure scenario",
					"Schema versioning — RunResult and DiffResult include schemaVersion for forward compatibility",
					"Exit codes standardized: 0=clean, 1=regressions, 2=config/infra issues across all commands",
				],
			},
		],
	},
	{
		version: "1.8.0",
		date: "2026-02-26",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate doctor rewrite — 9 itemized checks with pass/fail/warn/skip and exact remediation commands: project detection, config validity, baseline file, auth, evaluation target, API connectivity, evaluation access, CI wiring, provider env vars",
					"evalgate explain — offline report explainer: top 3 failing test cases, root cause classification (7 types: prompt drift, retrieval drift, formatting, tool-use, safety/cost/latency regression, coverage drop, stale baseline), prioritized fix suggestions",
					"evalgate print-config — resolved config viewer with [file]/[env]/[default]/[profile]/[arg] source annotations and secret redaction",
					"Doctor exit codes: 0=ready, 2=not ready, 3=infrastructure error",
					"Doctor --report flag — full JSON diagnostic bundle (versions, hashes, latency, all checks)",
					"Guided failure flow — evalgate ci → fail → 'Next: evalgate explain' → root causes + fixes",
					"evalgate check now writes .evalgate/last-report.json automatically after every run",
					"Minimal green example — examples/minimal-green/ passes on first run with zero dependencies",
				],
			},
		],
	},
	{
		version: "1.7.0",
		date: "2026-02-25",
		packages: ["TypeScript", "Platform"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate init — full project scaffolder: detects package manager, runs real tests, creates evals/baseline.json, installs .github/workflows/evalgate-gate.yml, idempotent",
					"evalgate upgrade --full — upgrades Tier 1 (built-in gate) to Tier 2: creates scripts/regression-gate.ts, adds npm scripts, installs baseline-governance.yml, adds CODEOWNERS entry",
					"detectRunner() — identifies test runner from package.json scripts (vitest, jest, mocha, node:test, ava, tap, or unknown)",
					"Machine-readable gate output — --format json|github|human for all gate commands; BuiltinReport includes durationMs, command, runner",
					"Init test matrix — scaffolder validates across npm/yarn/pnpm fixtures (25 tests: 4 fixtures × file creation + YAML + idempotency)",
				],
			},
			{
				title: "Fixed",
				items: [
					"DB test failures — 3 tests fixed: provider-keys Date vs String assertion, evaluation-service beforeAll timeout, redis-cache not-configured",
					"E2E smoke tests — toBeVisible() → toBeAttached() for headless Chromium CI compatibility",
					"Rollup CVE — >=4.59.0 override for GHSA-mw96-cpmx-2vgc (path traversal)",
					"Biome lint baseline reduced from 302 → 215 warnings (88 noExplicitAny fixes across source files)",
				],
			},
		],
	},
	{
		version: "1.6.0",
		date: "2026-02-24",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate baseline init — create starter evals/baseline.json with sample values and provenance metadata",
					"evalgate baseline update — run confidence tests + golden eval + latency benchmark, update baseline with real scores",
					"evalgate gate — local regression gate; exit codes: 0=pass, 1=regression, 2=infra_error, 3=confidence_failed, 4=confidence_missing",
					"evalgate gate --format json|github — machine-readable output and GitHub Step Summary with delta table",
					"GATE_EXIT, GATE_CATEGORY, REPORT_SCHEMA_VERSION, ARTIFACTS — regression gate constants exported",
					"RegressionReport, RegressionDelta, Baseline, GateExitCode, GateCategory types exported",
					"@evalgate/sdk/regression subpath export for tree-shakeable imports",
				],
			},
		],
	},
	{
		version: "1.5.8",
		date: "2026-02-22",
		packages: ["TypeScript"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"secureRoute TypeScript overload compatibility — implementation signature uses ctx: any for proper overload matching",
					"Test infrastructure — replaced invalid expect.unknown() with expect.any() across all test files",
					"NextRequest constructor — fixed test mocks using incorrect (NextRequest as any)() syntax",
					"304 response handling — exports API no longer returns invalid 304 response with a body",
					"Redis cache timeout — added explicit timeout to prevent test hangs in CI",
				],
			},
			{
				title: "Changed",
				items: [
					"Biome formatting — consistent line endings applied across 199 source files",
				],
			},
		],
	},
	{
		version: "1.5.5",
		date: "2026-02-19",
		packages: ["TypeScript", "Platform"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"Gate semantics: PASS / WARN / FAIL — --warnDrop flag introduces warn band between score drop and hard failure; profiles: strict (warnDrop=0), balanced (warnDrop=1), fast (warnDrop=2)",
					"--fail-on-flake — fail gate if a case is flagged as flaky across determinism runs",
					"Determinism audit — adaptive variance thresholds (absVariance ≤ 5 OR relVariance ≤ 2%); per-case [FLAKY] flags with pass rate across N runs",
					"Golden dataset regression — evals/golden/ with pnpm eval:golden to prevent semantic regressions; writes golden-results.json",
					"Nightly audits — audit-nightly.yml for determinism + performance budgets (skips without OPENAI_API_KEY)",
					"New audit scripts: audit:retention, audit:migrations, audit:performance, audit:determinism",
					"Platform safety docs: audit-trail.md, observability.md, data-retention.md, migration-safety.md, adoption-benchmark.md",
					"Exit code 8 = WARN (soft regression); RequestId propagated in EvalGateError from x-request-id header",
				],
			},
		],
	},
	{
		version: "1.5.0",
		date: "2026-02-18",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate check --format github — GitHub Actions annotations + step summary ($GITHUB_STEP_SUMMARY)",
					"evalgate check --format json — machine-readable output only",
					"evalgate check --onFail import — on gate failure, imports run metadata + failures to dashboard (idempotent per CI run)",
					"evalgate check --explain — shows score breakdown (contribPts) and thresholds",
					"evalgate doctor — verify CI setup (config, API key, quality endpoint, baseline)",
					"check now writes .evalgate/last-report.json automatically after every run",
					"Failure hint — prints 'Next: evalgate explain' on gate failure; step summary includes explain tip",
				],
			},
		],
	},
	{
		version: "1.4.1",
		date: "2026-02-18",
		packages: ["TypeScript"],
		type: "fix",
		sections: [
			{
				title: "Added",
				items: [
					"evalgate check --baseline production — compare against latest run tagged with environment=prod",
					"Package hardening — files, module, sideEffects: false for leaner npm publish",
				],
			},
		],
	},
	{
		version: "1.3.0",
		date: "2025-10-21",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"Client-side request caching — automatic TTL caching of GET requests; 30-60% faster repeated queries; configurable cache size; auto-invalidation on mutations",
					"Cursor-based pagination — PaginatedIterator class, autoPaginate() async generator, encodeCursor()/decodeCursor() helpers",
					"Request batching — configurable batch size + delay; 50-80% reduction in network requests for bulk operations",
					"Connection pooling — HTTP keep-alive via config.keepAlive; 20-40% lower latency for sequential requests",
					"Configurable retry strategies — exponential, linear, or fixed backoff with custom retryable error codes",
				],
			},
		],
	},
	{
		version: "1.2.2",
		date: "2025-10-20",
		packages: ["TypeScript"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"Browser compatibility — safe getEnvVar() helper; AIEvalClient.init() and constructor now work without process.env",
					"Type name collision — TestCase → TestSuiteCase; TestCaseResult → TestSuiteCaseResult; legacy aliases preserved for backward compat",
					"AsyncLocalStorage TypeScript TS2347 compilation error in strict mode",
				],
			},
		],
	},
	{
		version: "1.2.1",
		date: "2025-01-20",
		packages: ["TypeScript"],
		type: "fix",
		sections: [
			{
				title: "Fixed",
				items: [
					"CLI import paths — compiled paths (../client.js) instead of source paths (../src/client)",
					"Duplicate trace creation — OpenAI/Anthropic integrations now create one trace with final status instead of two",
					"Commander.js nested command syntax — eval:run replaces invalid eval run",
					"Browser-safe context — AsyncLocalStorage replaced with environment-aware implementation (Node.js: full propagation; browser: stack-based)",
					"Path traversal security — snapshot path validation prevents ../ escapes and enforces directory boundary",
				],
			},
		],
	},
	{
		version: "1.2.0",
		date: "2025-10-15",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"100% API coverage — all backend endpoints now supported in the SDK",
					"Annotations API — human-in-the-loop evaluation tasks and assignments",
					"Developer API — API key and webhook management (create, list, delete, usage tracking)",
					"LLM Judge Extended — enhanced judge capabilities with alignment metrics",
					"Organizations API — org details, members, and resource limits access",
					"40+ new TypeScript interfaces across all API surface areas",
				],
			},
		],
	},
	{
		version: "1.1.0",
		date: "2025-01-10",
		packages: ["TypeScript"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"Comprehensive evaluation template types",
					"Organization resource limits tracking",
					"getOrganizationLimits() method",
				],
			},
		],
	},
	{
		version: "1.0.0",
		date: "2025-01-01",
		packages: ["TypeScript", "Python"],
		type: "feature",
		sections: [
			{
				title: "Added",
				items: [
					"Initial release — Traces, Evaluations, LLM Judge APIs",
					"Framework integrations for OpenAI and Anthropic",
					"Test suite builder with 20+ assertion functions",
					"Context propagation system with AsyncLocalStorage",
					"Error handling with retry logic and typed error hierarchy",
					"Python SDK 1.0.0 — initial PyPI release (pauly4010-evalai-sdk); API parity with TypeScript client",
				],
			},
		],
	},
];

export default function ChangelogPage() {
	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Header */}
			<header className="border-b border-border px-4 sm:px-6 py-4">
				<div className="mx-auto max-w-4xl flex items-center justify-between">
					<Link href="/" className="text-lg font-bold">
						EvalGate
					</Link>
					<div className="flex items-center gap-3">
						<Button variant="outline" size="sm" asChild>
							<Link href="/documentation">Docs</Link>
						</Button>
						<ThemeToggle />
					</div>
				</div>
			</header>

			{/* Content */}
			<main className="flex-1 py-8 sm:py-12">
				<div className="mx-auto max-w-4xl px-4 sm:px-6">
					<div className="mb-8">
						<Button variant="ghost" size="sm" asChild className="mb-4">
							<Link href="/documentation">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back to Documentation
							</Link>
						</Button>
						<h1 className="text-3xl sm:text-4xl font-bold mb-3">Changelog</h1>
						<p className="text-muted-foreground text-lg">
							All notable changes to{" "}
							<a
								href="https://www.npmjs.com/package/@evalgate/sdk"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline inline-flex items-center gap-1"
							>
								@evalgate/sdk
								<ExternalLink className="h-3.5 w-3.5" />
							</a>{" "}
							·{" "}
							<a
								href="https://pypi.org/project/pauly4010-evalgate-sdk/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline inline-flex items-center gap-1"
							>
								pauly4010-evalgate-sdk
								<ExternalLink className="h-3.5 w-3.5" />
							</a>{" "}
							· Platform
						</p>
					</div>

					<div className="space-y-6">
						{versions.map((release) => (
							<Card key={release.version}>
								<CardHeader>
									<div className="flex flex-wrap items-center gap-2">
										<Package className="h-5 w-5 text-muted-foreground shrink-0" />
										<CardTitle className="text-xl">
											v{release.version}
										</CardTitle>
										{release.packages.map((pkg) => (
											<Badge
												key={pkg}
												variant="outline"
												className={packageStyles[pkg]}
											>
												{pkg}
											</Badge>
										))}
										<Badge
											variant="outline"
											className={typeStyles[release.type]}
										>
											{typeLabel[release.type]}
										</Badge>
										<span className="text-sm text-muted-foreground ml-auto">
											{new Date(release.date).toLocaleDateString("en-US", {
												year: "numeric",
												month: "long",
												day: "numeric",
											})}
										</span>
									</div>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{release.sections.map((section) => (
											<div key={section.title}>
												<h4
													className={`text-xs font-semibold uppercase tracking-wider mb-2 ${sectionStyles[section.title]}`}
												>
													{section.title}
												</h4>
												<ul className="space-y-1.5">
													{section.items.map((item) => (
														<li
															key={item}
															className="flex items-start gap-2 text-sm text-muted-foreground"
														>
															<span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
															{item}
														</li>
													))}
												</ul>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					<div className="mt-8 text-center">
						<p className="text-muted-foreground text-sm">
							Full changelog on{" "}
							<a
								href="https://github.com/evalgate/ai-evaluation-platform"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								GitHub
							</a>
							{" · "}
							<a
								href="https://www.npmjs.com/package/@evalgate/sdk?activeTab=versions"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								npm version history
							</a>
							{" · "}
							<a
								href="https://pypi.org/project/pauly4010-evalgate-sdk/#history"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								PyPI history
							</a>
						</p>
					</div>
				</div>
			</main>

			<Footer />
		</div>
	);
}
