# Changelog

All notable changes to the @evalgate/sdk package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.2] - 2026-03-09

### Added — Judge Credibility, Analyze Phase, Measurement & CI

#### P1: Judge Credibility

- **`judge-credibility.ts`** — TPR/TNR computation with bias-corrected pass rate: θ̂ = (p_obs + TNR − 1) / (TPR + TNR − 1), clipped to [0, 1]
- **Bootstrap CI** — deterministic seed (default: 42, configurable via `judge.bootstrapSeed`)
- **Graceful degradation** — skip correction when discriminative power (TPR+TNR−1) ≤ 0.05; skip CI when n < 30; both emit `correctionSkippedReason` / `ciSkippedReason` into `judgeCredibility` report block
- **Gate exit 8 (WARN)** — emitted when correction is skipped but thresholds are configured
- **`evalgate diff`** — flags apples-to-oranges comparison when correction basis differs between runs
- **`judgeTprMin`, `judgeTnrMin`, `judgeMinLabeledSamples`** — new check args with gate enforcement
- **Doctor checks** — weak judge and low sample-count alignment warnings
- **Train/dev/test split policy** — enforcement to prevent prompt/eval set contamination

#### P2: Analyze Phase

- **Canonical labeled dataset schema** — `.evalgate/golden/labeled.jsonl`; fields: `caseId`, `input`, `expected`, `actual`, `label`, `failureMode`, `labeledAt`
- **`evalgate label`** — interactive per-trace CLI: numbered failure-mode menu, resume support, undo (`u`), progress indicator, session summary
- **`evalgate analyze`** — reads labeled JSONL, outputs per-mode frequency report
- **`evalgate failure-modes`** — structured CLI to define 5–10 named binary failure modes with pass/fail criteria
- **`evalgate.md`** — unified human-maintained intent document; initialized by `evalgate init`, consumed by CLI and judge as context

#### P3: Measurement & CI

- **Per-failure-mode frequency map** — added to run results summary
- **Frequency × impact prioritization** — added to `evalgate explain` output
- **`failureModeAlerts` config** — per-mode impact weights + alert thresholds (count-based and percent-based), global thresholds
- **`withCostTier()` method** — cost-tier labeling on assertions; `code` vs `llm` tags
- **Normalized eval budget** — trace-count mode ships now; Stripe LLM billing stubbed behind `CostProvider` interface
- **`evaluateReplayOutcome()`** — compares corrected pass rates first, falls back to raw; emits `keep`/`discard` with `comparisonBasis` field
- **`evalgate replay-decision`** — `--previous`/`--current` run comparison command
- **Partial results on budget exceeded** — saved before process exits

#### P4 & P5: Framing, Docs & Production Loop

- **`evalgate explain`** — spec vs generalization classification: `SPECIFICATION GAP` vs `GENERALIZATION FAILURE`
- **`docs/zero-to-golden-30-minutes.md`** — 5-step onboarding: init → discover+run → label → analyze → ci
- **`docs/report-trace.md`** — asymmetric sampling model with all three modes and negative-feedback bypass
- **`docs/replay.md`** — distinguishes `evalgate replay` (candidate) from `evalgate replay-decision` (run comparison)
- Golden set health checks, before/after `evalgate.md` examples, and README assertions section restructured

---

## [3.0.0] - 2026-03-04

### Breaking — AI Reliability Loop

EvalGate is no longer just a CI eval runner — it is now a full **AI reliability loop**. Production failures automatically become regression tests.

- **Major version bump** signals the identity shift from "LLM evaluation platform" to "AI quality infrastructure"
- No breaking changes to existing SDK exports or CLI commands — this is a capability expansion

### Added

#### Production-to-CI Loop (T0–T8)

- **`POST /api/collector`** — Single-payload trace + spans ingest endpoint (LangWatch-compatible schema)
- **Server-side sampling** — Error traces and negative feedback always analyzed; success traces sampled at configurable rate (default 10%)
- **Async failure detection pipeline** — `trace_failure_analysis` background job: detect → group → generate → score → auto-promote
- **Failure grouping** — SHA-256 `group_hash` deduplicates recurring failure patterns across traces
- **Auto-promotion heuristic** — Candidates with `quality ≥ 90 AND confidence ≥ 0.8 AND detectors ≥ 2` auto-promoted to golden regression suite
- **Golden regression dataset** — First-class `golden_regression` evaluation type per org, auto-created on first promote
- **Candidate eval cases** — Quarantined test case candidates with full lifecycle: `quarantined → approved → promoted`
- **User feedback endpoint** — `POST /api/traces/:id/feedback` with thumbs-down triggering analysis
- **SDK `reportTrace()`** — Lightweight single-call trace reporting with client-side sampling
- **`evalgate promote`** — CLI command to promote candidates (`--auto` for bulk, `--list` to view)
- **`evalgate replay`** — CLI command to replay candidate against current model with constraint evaluation

#### Production Hardening

- **Collector idempotency** — `ON CONFLICT DO NOTHING` on both `traces.traceId` and `spans.spanId`; SDK retries never create duplicates
- **Rate-limit guardrail** — Sliding-window rate limiter (`MAX_ANALYSIS_RATE=200/min` per org); traffic spikes don't overwhelm the analysis pipeline
- **`analysis_status` on traces** — `pending → analyzing → analyzed → failed` lifecycle tracking
- **`source` + `environment` columns** — First-class `source` (sdk/api/cli) and `environment` (production/staging/dev) on traces table
- **Compound unique index** — `idx_traces_org_trace_id` on `(organization_id, trace_id)` for multi-tenant idempotency
- **Dedup against existing tests** — `deduplicateAgainstExistingTests()` prevents near-duplicates in golden dataset (input hash + title match)

#### Schema Changes (Migration: `0002_kind_ego.sql`)

- `traces.analysis_status` — text, default `'pending'`
- `traces.source` — text, nullable
- `traces.environment` — text, nullable
- `idx_traces_org_trace_id` — unique index on `(organization_id, trace_id)`

#### New DB Tables (Migration: `0001_adorable_squadron_sinister.sql`)

- `failure_reports` — 21 columns, failure detection persistence with group hash
- `candidate_eval_cases` — 19 columns, quarantined test case candidates
- `user_feedback` — 8 columns, end-user feedback signals

### New Tests

- 70 unit tests + 18 DB tests = **88 new tests** for the production-to-CI loop + hardening
- Rate limiter: 10 tests, sampling: 8 tests, collector schema: 18 tests, pipeline: 26 tests, CLI: 11 tests, DB schema: 18 tests

---

## [2.3.0] - 2026-03-04

### Breaking

- **`hasConsistency` / `hasConsistencyAsync` return `{ score, passed }` instead of `{ score, consistent }`** — aligns with every other assertion in the SDK that returns a `passed` field. If you were destructuring `consistent`, rename it to `passed`:
  ```ts
  // Before:
  const { score, consistent } = hasConsistency(outputs);
  // After:
  const { score, passed } = hasConsistency(outputs);
  ```
- **`respondedWithinDuration` / `respondedWithinTimeSince` return `AssertionResult` instead of `boolean`** — these now return `{ name, passed, expected, actual, message }` like all other assertions, enabling uniform pipeline usage and failure messages. The deprecated `respondedWithinTime` alias also returns `AssertionResult`.
  ```ts
  // Before:
  const ok = respondedWithinDuration(250, 500); // boolean
  // After:
  const { passed } = respondedWithinDuration(250, 500); // AssertionResult
  ```

### Added

- **`computeBaselineChecksum` / `verifyBaselineChecksum` in main barrel** — previously only reachable via `@evalgate/sdk/cli/baseline` subpath. Now importable directly from `@evalgate/sdk`.
- **`resetSentimentDeprecationWarning` in main barrel** — the one-time deprecation reset utility for `hasSentimentAsync` is now importable from the main entry point, making it easier to test deprecation behavior. `SentimentAsyncResult` type was already exported.

---

## [2.2.3] - 2026-03-03

### Breaking

- **`PaginatedIterator` API changed from cursor-based to offset-based** — the constructor signature changed from `(cursor) => { items, nextCursor, hasMore }` to `(offset, limit) => { data, hasMore }`. If you were using `PaginatedIterator` directly with a cursor-based fetcher, update your callback to accept `(offset: number, limit: number)` and return `{ data: T[], hasMore: boolean }`. The `autoPaginate` and `autoPaginateGenerator` helpers also use the new offset-based signature. Cursor encoding/decoding utilities (`encodeCursor`, `decodeCursor`) remain available for server-side cursor generation.
- **`RequestCache` removed from public exports** — `RequestCache` was an internal HTTP cache with a method-specific API (`set(method, url, data, ttl, params)`) that did not match general-purpose cache expectations. It is no longer exported from the package entry point. If you were importing it directly, use your own cache implementation or rely on the SDK's built-in automatic caching. `CacheTTL` constants remain exported for advanced configuration.

### Fixed

- **`RequestCache.set` missing default TTL** — entries stored without an explicit TTL were immediately stale on next read. Default is now `CacheTTL.MEDIUM`; callers that omit `ttl` get a live cache entry instead of a cache miss every time.
- **`EvalGateError` subclass prototype chain** — `ValidationError.name` was silently overwritten by the base class constructor, surfacing as `"EvalGateError"` in stack traces and `instanceof` checks. All four subclasses (`ValidationError`, `RateLimitError`, `AuthenticationError`, `NetworkError`) now call `Object.setPrototypeOf(this, Subclass.prototype)` and set `this.name` after `super()`.
- **`RateLimitError.retryAfter` not a direct property** — the value was only stored inside `details.retryAfter` and not accessible as `err.retryAfter`. It is now assigned directly on the instance when provided.
- **`autoPaginate` returned `AsyncGenerator` instead of `Promise<T[]>`** — calling `await autoPaginate(fetcher)` was resolving to an unexhausted generator. It now collects all pages and returns a flat `Promise<T[]>`. The original streaming behaviour is available via the new `autoPaginateGenerator` export.
- **`createEvalRuntime` string-only overload** — passing `{ name, projectRoot }` config objects was ignored (treated as `process.cwd()`). The function now accepts `string | { name?: string; projectRoot?: string }` and extracts `projectRoot` correctly.
- **`defaultLocalExecutor` was an instance, not a factory** — importing `defaultLocalExecutor` returned a pre-constructed executor rather than a callable factory. It is now re-exported as `createLocalExecutor` so each import site can call it to get a fresh instance.
- **`SnapshotManager.save` crash on `undefined`/`null` output** — passing `undefined` or `null` to `snapshot(name, output)` threw `TypeError: Cannot convert undefined to string`. Both values are now serialized to the strings `"undefined"` and `"null"` respectively, matching the existing `null`-safe coercion already present for objects.
- **`compareSnapshots` loaded raw string instead of disk snapshot** — the old `compareWithSnapshot` alias passed its second argument as literal content rather than a snapshot name, producing meaningless diffs. The new `compareSnapshots(nameA, nameB, dir?)` loads both snapshots from disk before diffing.
- **`AIEvalClient` default `baseUrl`** — the no-arg constructor defaulted to `http://localhost:3000`, causing silent failures in production environments. Default is now `https://api.evalgate.com`.
- **`importData` unguarded `client.traces` / `client.evaluations` access** — calling `importData(data)` with a partial or undefined client could throw `TypeError: Cannot read properties of undefined`. Both property accesses now use optional chaining (`client?.traces`, `client?.evaluations`).
- **`toContainCode` required a fenced code block** — raw function definitions, `const` assignments, class declarations, arrow functions, `import`/`export` statements, and `return` expressions now satisfy the assertion without needing triple-backtick fencing.
- **`hasReadabilityScore` ignored `{min}` object form** — passing `{ min: 40 }` instead of a plain number was coerced to `NaN` threshold, making every call return `true`. The function now unwraps `{ min?, max? }` objects and applies both bounds.

### Added

- **`autoPaginateGenerator`** — new export for streaming pagination as an `AsyncGenerator<T[]>` (one chunk per page). Use when you want to process pages incrementally rather than wait for all pages to load.
- **`compareSnapshots(nameA, nameB, dir?)`** — loads both named snapshots from disk and returns a `SnapshotComparison`. Replaces the incorrectly aliased `compareWithSnapshot`.
- **141 new regression tests** across 9 test files covering all fixes above: `RequestCache` TTL defaults, error class prototype chains, `autoPaginate` flat-array return, `createEvalRuntime` config-object overload, `defaultLocalExecutor` callable factory, `SnapshotManager` null/undefined handling, `compareSnapshots` disk-load path, `AIEvalClient` default `baseUrl`, `importData` guards, `toContainCode` raw-code detection, and `hasReadabilityScore` object form.
- **`upgrade --full` post-upgrade warning** — CLI now prints a reminder to run `npx evalgate baseline update` after a full upgrade to avoid a false regression on the next CI run.
- **Optional chaining on OpenAI / Anthropic integration `traces.create`** — `evalClient.traces?.create(...)` prevents crashes when the `traces` resource is unavailable on the client (e.g. minimal config or testing without a full API key).

---

## [2.2.2] - 2026-03-03

### Fixed

- **8 stub assertions replaced with real implementations:**
  - `hasSentiment` — substring matching + expanded 34/31-word positive/negative lexicon (was exact-match, 4 words each)
  - `hasNoHallucinations` — case-insensitive fact matching (was case-sensitive)
  - `hasFactualAccuracy` — case-insensitive fact matching (was case-sensitive)
  - `containsLanguage` — expanded from 3 languages (en/es/fr) to 12 (+ de/it/pt/nl/ru/zh/ja/ko/ar) with BCP-47 subtag support (`zh-CN` → `zh`)
  - `hasValidCodeSyntax` — real bracket/brace/parenthesis balance checker with string literal and comment awareness (handles JS `//`/`/* */`, Python `#`, template literals, single/double quotes); JSON fast-path via `JSON.parse`
  - `hasNoToxicity` — expanded from 4 words to ~80 terms across 9 categories: insults, degradation, violence/threats, self-harm directed at others, dehumanization, hate/rejection, harassment, profanity-as-attacks, bullying/appearance/mental-health weaponization
  - `hasReadabilityScore` — fixed Flesch-Kincaid syllable counting to be per-word (was treating entire text as one word)
  - `matchesSchema` — now dispatches on schema format: JSON Schema `required` array (`{ required: ['name'] }` → checks required keys exist), JSON Schema `properties` object (`{ properties: { name: {} } }` → checks property keys exist), or simple key-presence template (existing behavior preserved for backward compat). Fixes regression: `matchesSchema({ name: 'test', score: 95 }, { type: 'object', required: ['name'] })` was returning `false`
- **`importData` crash** — `options: ImportOptions` parameter now defaults to `{}` to prevent `Cannot read properties of undefined (reading 'dryRun')` when called as `importData(client, data)`
- **`compareWithSnapshot` / `SnapshotManager.compare` object coercion** — both now accept `unknown` input and coerce non-string values via `JSON.stringify` before comparison, matching the existing behavior of `SnapshotManager.save()`
- **`WorkflowTracer` constructor crash** — defensive guard: `typeof client?.getOrganizationId === "function"` before calling it; prevents `TypeError: client.getOrganizationId is not a function` when using partial clients or initializing without an API key

### Added

- **LLM-backed async assertion variants** — 6 new exported functions:
  - `hasSentimentAsync(text, expected, config?)` — LLM classifies sentiment with full context awareness
  - `hasNoToxicityAsync(text, config?)` — LLM detects sarcastic, implicit, and culturally specific toxic content that blocklists miss
  - `containsLanguageAsync(text, language, config?)` — LLM language detection for any language
  - `hasValidCodeSyntaxAsync(code, language, config?)` — LLM deep syntax analysis beyond bracket balance
  - `hasFactualAccuracyAsync(text, facts, config?)` — LLM checks facts semantically, catches paraphrased inaccuracies
  - `hasNoHallucinationsAsync(text, groundTruth, config?)` — LLM detects fabricated claims even when paraphrased
- **`configureAssertions(config: AssertionLLMConfig)`** — set global LLM provider/apiKey/model/baseUrl once; all `*Async` functions use it automatically; per-call `config` overrides it
- **`getAssertionConfig()`** — retrieve current global assertion LLM config
- **`AssertionLLMConfig` type** — exported interface: `{ provider: "openai" | "anthropic"; apiKey: string; model?: string; baseUrl?: string }`
- **JSDoc `**Fast and approximate**` / `**Slow and accurate**` markers** on all sync/async assertion pairs with `{@link xAsync}` cross-references that appear in IDE tooltips
- **115 new tests** in `assertions.test.ts` covering all improved sync assertions (expanded lexicons, JSON Schema formats, bracket balance edge cases, 12-language detection, BCP-47) and all 6 async variants (OpenAI path, Anthropic path, global config, error cases, HTTP 4xx handling)

---

## [2.2.1] - 2026-03-03

### Fixed

- **`snapshot(name, output)` accepts objects** — passing `{ score: 92 }` no longer throws; non-string values are auto-serialized via `JSON.stringify`. `SnapshotManager.save()` and `update()` widened to `output: unknown` accordingly.

---

## [2.2.0] - 2026-03-03

### Breaking

- **`snapshot(output, name)` → `snapshot(name, output)`** — parameter order swapped to match natural call convention (`name` first, value second, same as `test('name', fn)`). Update any existing `snapshot(output, 'label')` calls to `snapshot('label', output)`.

### Added

- **`expect().not` modifier** — `expect('drop table').not.toContain('drop table')` now works; negates `passed` on any chained assertion via Proxy
- **`hasPII(text)`** — semantic inverse of `notContainsPII`; returns `true` when PII is detected (email, phone, SSN, IP). Exported from main package. Eliminates double-negative confusion.
- **`defineSuite` object form** — now accepts both `defineSuite(name, [...fns])` and `defineSuite({ name, specs: [...fns] })`. README updated with examples.

### Fixed

- **`specId` collision** — all specs in `eval/` directory shared the same 8-char ID (`ZXZhbC9j`). Root cause: short base64 prefix was identical for any path starting with `eval/c`. Fixed: SHA-256 hex (16 chars) in `discover.ts`.
- **`explain` UNKNOWN verdict** — `evalgate explain` showed `Verdict: UNKNOWN` when reading `.evalgate/last-run.json`. Added `RunResult` format detection (`results[]` + `summary`). Added `.evalgate/last-run.json` and `.evalgate/runs/latest.json` to auto-search paths. Passing runs now show clean `✅ PASS` with no spurious "Run doctor" suggestions.
- **`print-config` baseUrl default** — was `http://localhost:3000`; now `https://api.evalgate.com` to match `evalgate doctor`.
- **`baseline update` self-contained** — no longer requires a custom `eval:baseline-update` npm script. Falls back to built-in mode (runs `pm test`, stamps baseline) if no script is present.
- **`notContainsPII` phone regex** — broadened to cover `555-123-4567`, `555.123.4567`, and `555 123 4567` formats. JSDoc clarified: `false` = PII found (unsafe), `true` = no PII (safe).
- **`impact-analysis` git error** — replaced raw `git diff --help` wall-of-text with clean targeted messages: `Not a git repository`, `Base branch 'X' not found. Fetch it first`, or generic exit-code message.
- **README quickstart** — both `defineEval` examples now include an `executor` function. Running the quickstart no longer throws `Executor must be a function`.
- **`snapshot` module docstring** — updated `@example` to reflect new `(name, output)` parameter order.

---

## [2.1.3] - 2026-03-02

### Fixed

- **Critical:** Multi-`defineEval` calls per file — only first was discovered (silent data loss)
- **High:** First-run gate false regression on fresh init when no test script exists
- **High:** Doctor defaults baseUrl to localhost:3000 instead of production API
- **Critical:** Simulated executeSpec replaced with real spec execution
- **High:** Run scores now include scoring model context for clarity
- **Low:** Explain no longer shows "unnamed" for builtin gate failures
- **Docs:** Added missing `discover --manifest` step to local quickstart

---

## [2.1.2] - 2026-03-02

### Fixed

- **Type safety** — aligned with platform 2.1.2; zero TypeScript errors across all integration points
- **CI gate** — all SDK tests, lint, and build checks passing

---

## [2.1.1] - 2026-03-02

### Fixed

- Version alignment with platform 2.1.1

---

## [2.0.0] - 2026-03-01

### Breaking — EvalGate Rebrand

- **Package:** `@pauly4010/evalai-sdk` → `@evalgate/sdk`
- **CLI:** `evalai` → `evalgate`
- **Config dir:** `.evalai/` → `.evalgate/` (legacy still read with deprecation warning)
- **Env vars:** `EVALAI_*` → `EVALGATE_*` (legacy still work with deprecation warning)
- **Error class:** `EvalAIError` → `EvalGateError`
- **HTTP headers:** `X-EvalAI-*` → `X-EvalGate-*`

### Added

- Deprecation warnings when using `EVALAI_*` env vars or `.evalai/` config

### Deprecated

- `@pauly4010/evalai-sdk` — use `@evalgate/sdk` instead

---

## [1.9.0] - 2026-02-27

### ✨ Added

#### CLI — One-Command CI Loop (`evalai ci`)

- **`evalai ci`** — Single command teams put in GitHub workflows and never think about again
- **Complete CI pipeline**: discover → manifest → impact → run → diff → PR summary → safe failure → "next step"
- **Automatic manifest building**: Builds manifest if missing, no manual steps required
- **Impact analysis integration**: `--impacted-only` flag for targeted testing
- **Smart exit codes**: 0=clean, 1=regressions, 2=config/infra issues
- **Self-documenting failures**: Always prints copy/paste next step for debugging
- **GitHub Step Summary integration**: Automatic PR summaries with regressions and artifacts

#### CLI — Durable Run History & Diff System

- **Run artifact retention**: Timestamped artifacts in `.evalai/runs/run-<runId>.json`
- **Run index file**: `.evalai/runs/index.json` tracks all runs with metadata
- **Schema versioning**: `RunResult` and `DiffResult` include `schemaVersion` for compatibility
- **Base/head shortcuts**: `--base baseline`, `--base last`, `--head last` for common cases
- **Floating point normalization**: Consistent score/delta calculations across runs
- **Comprehensive diff comparison**: Classifies regressions, improvements, added, removed specs

#### CLI — Centralized Architecture

- **Environment detection**: `isCI()`, `isGitHubActions()`, `getGitHubStepSummaryPath()` unified
- **Workspace resolution**: `resolveEvalWorkspace()` provides all `.evalai` paths
- **Git reference detection**: Comprehensive patterns for branches, tags, and ranges
- **No more duplication**: All commands use shared utilities for consistency

#### CLI — CI Friendliness

- **Fail-safe base resolution**: Clear error messages when base artifacts missing in CI
- **GitHub Step Summary**: Rich markdown summaries with metrics, regressions, and artifact links
- **CI-specific error handling**: Exit code 2 for config issues with helpful guidance
- **Artifact download instructions**: Exact commands for manual base artifact setup

### 🔧 Changed

- **Exit codes standardized**: 0=clean, 1=regressions, 2=config/infra issues across all commands
- **Schema compatibility**: Added `schemaVersion` validation for future-proofing
- **Path resolution**: All commands use centralized workspace helpers
- **Error messages**: More actionable and context-aware guidance

### 📊 New Features Summary

- **One-command CI**: `evalai ci` replaces multi-step workflows
- **Durable history**: Run artifacts preserved with smart indexing
- **Smart diffing**: Automated regression detection with GitHub integration
- **Centralized utilities**: Environment detection and workspace resolution unified
- **Self-documenting**: Clear next steps for any failure scenario

---

## [1.8.0] - 2026-02-26

### ✨ Added

#### CLI — `evalai doctor` Rewrite (Comprehensive Checklist)

- **9 itemized checks** with pass/fail/warn/skip status and exact remediation commands:
  1. Project detection (package.json + lockfile + package manager)
  2. Config file validity (evalai.config.json)
  3. Baseline file (evals/baseline.json — schema, staleness)
  4. Authentication (API key presence, redacted display)
  5. Evaluation target (evaluationId configured)
  6. API connectivity (reachable, latency)
  7. Evaluation access (permissions, baseline presence)
  8. CI wiring (.github/workflows/evalai-gate.yml)
  9. Provider env vars (OpenAI/Anthropic/Azure — optional)
- **Exit codes**: `0` ready, `2` not ready, `3` infrastructure error
- **`--report`** flag outputs full JSON diagnostic bundle (versions, hashes, latency, all checks)
- **`--format json`** for machine-readable output

#### CLI — `evalai explain` (New Command)

- **Offline report explainer** — reads `.evalai/last-report.json` or `evals/regression-report.json` with zero flags
- **Top 3 failing test cases** with input/expected/actual
- **What changed** — baseline vs current with directional indicators
- **Root cause classification**: prompt drift, retrieval drift, formatting drift, tool-use drift, safety/cost/latency regression, coverage drop, baseline stale
- **Prioritized suggested fixes** with actionable commands
- Works with both `evalai check` reports (CheckReport) and `evalai gate` reports (BuiltinReport)
- **`--format json`** for CI pipeline consumption

#### Guided Failure Flow

- **`evalai check` now writes `.evalai/last-report.json`** automatically after every run
- **Failure hint**: prints `Next: evalai explain` on gate failure
- **GitHub step summary**: adds tip about `evalai explain` and report artifact location on failure

#### CI Template Improvements

- **Doctor preflight step** added to generated workflow (`continue-on-error: true`)
- **Report artifact upload** now includes both `evals/regression-report.json` and `.evalai/last-report.json`

#### `evalai init` Output Updated

- First recommendation: `npx evalai doctor` (verify setup)
- Full command reference: doctor, gate, check, explain, baseline update

#### CLI — `evalai print-config` (New Command)

- **Resolved config viewer** — prints every config field with its current value
- **Source-of-truth annotations**: `[file]`, `[env]`, `[default]`, `[profile]`, `[arg]` for each field
- **Secrets redacted** — API keys shown as `sk_t...abcd`
- **Environment summary** — shows all relevant env vars (EVALAI_API_KEY, OPENAI_API_KEY, CI, etc.)
- **`--format json`** for machine-readable output
- Accepts `--evaluationId`, `--baseUrl`, etc. to show how CLI args would merge

#### Minimal Green Example

- **`examples/minimal-green/`** — passes on first run, no account needed
- Zero dependencies, 3 `node:test` tests
- Clone → init → doctor → gate → ✅

### 🔧 Changed

- `evalai doctor` exit codes changed: was `0`/`1`, now `0`/`2`/`3`
- SDK README: added Debugging & Diagnostics section with guided flow diagram
- SDK README: added Doctor Exit Codes table
- Doctor test count: 4 → 29 tests; added 9 explain tests (38 total new tests)

---

## [1.7.0] - 2026-02-25

### ✨ Added

#### CLI — `evalai init` Full Project Scaffolder

- **`evalai init`** — Zero-to-gate in under 5 minutes:
  - Detects Node repo + package manager (npm/yarn/pnpm)
  - Runs existing tests to capture real pass/fail + test count
  - Creates `evals/baseline.json` with provenance metadata
  - Installs `.github/workflows/evalai-gate.yml` (package-manager aware)
  - Creates `evalai.config.json`
  - Prints copy-paste next steps — just commit and push
  - Idempotent: skips files that already exist

#### CLI — `evalai upgrade --full` (Tier 1 → Tier 2)

- **`evalai upgrade --full`** — Upgrade from built-in gate to full gate:
  - Creates `scripts/regression-gate.ts` (full gate with `--update-baseline`)
  - Adds `eval:regression-gate` + `eval:baseline-update` npm scripts
  - Creates `.github/workflows/baseline-governance.yml` (label + diff enforcement)
  - Upgrades `evalai-gate.yml` to project mode
  - Adds `CODEOWNERS` entry for `evals/baseline.json`

#### Gate Output — Machine-Readable Improvements

- **`detectRunner()`** — Identifies test runner from `package.json` scripts: vitest, jest, mocha, node:test, ava, tap, or unknown
- **BuiltinReport** now always emits: `durationMs`, `command`, `runner`, `baseline` metadata
- Report schema updated with optional `durationMs`, `command`, `runner` properties

#### Init Scaffolder Integration Tests

- 4 fixtures: npm+jest, pnpm+vitest, yarn+jest, pnpm monorepo
- 25 tests: files created, YAML valid, pm-aware workflow, idempotent runs
- All fixtures use `node:test` (zero external deps)

### 🔧 Changed

- CLI help text updated to include `upgrade` command
- Gate report includes runner detection and timing metadata
- SDK test count: 147 → 172 tests (12 → 15 contract tests)

---

## [1.6.0] - 2026-02-24

### ✨ Added

#### CLI — Regression Gate & Baseline Management

- **`evalai baseline init`** — Create a starter `evals/baseline.json` with sample values and provenance metadata
- **`evalai baseline update`** — Run confidence tests, golden eval, and latency benchmark, then update baseline with real scores
- **`evalai gate`** — Run the local regression gate with proper exit code taxonomy (0=pass, 1=regression, 2=infra_error, 3=confidence_failed, 4=confidence_missing)
- **`evalai gate --format json`** — Output `evals/regression-report.json` as machine-readable JSON to stdout
- **`evalai gate --format github`** — Output GitHub Step Summary markdown with delta table

#### SDK Exports — Regression Gate Constants & Types

- **`GATE_EXIT`** — Exit code constants (`PASS`, `REGRESSION`, `INFRA_ERROR`, `CONFIDENCE_FAILED`, `CONFIDENCE_MISSING`)
- **`GATE_CATEGORY`** — Report category constants (`pass`, `regression`, `infra_error`)
- **`REPORT_SCHEMA_VERSION`** — Current schema version for `regression-report.json`
- **`ARTIFACTS`** — Well-known artifact paths (`BASELINE`, `REGRESSION_REPORT`, `CONFIDENCE_SUMMARY`, `LATENCY_BENCHMARK`)
- **Types**: `RegressionReport`, `RegressionDelta`, `Baseline`, `BaselineTolerance`, `GateExitCode`, `GateCategory`
- **Subpath export**: `@pauly4010/evalai-sdk/regression` for tree-shakeable imports

### 🔧 Changed

- CLI help text updated to include `baseline` and `gate` commands
- SDK becomes the public contract for regression gate — scripts are implementation detail

---

## [1.5.8] - 2026-02-22

### 🐛 Fixed

- **secureRoute TypeScript overload compatibility** — Fixed implementation signature to use `ctx: any` for proper overload compatibility
- **Test infrastructure fixes** — Replaced invalid `expect.unknown()` with `expect.any()` across test files
- **NextRequest constructor** — Fixed test mocks using incorrect `(NextRequest as any)()` syntax
- **304 response handling** — Fixed exports API returning invalid 304 response with body
- **Error catalog tests** — Updated test expectations to match actual EvalAIError behavior
- **Redis cache timeout** — Added explicit timeout to prevent test hangs

### 🔧 Changed

- **Biome formatting** — Applied consistent line endings across 199 files

---

## [1.5.7] - 2026-02-20

### 📚 Documentation

- **Version bump** — Updated documentation to reflect v1.5.6 changes including CJS compatibility
- **README consistency** — Aligned version references across CLI section and changelog
- **Environment support** — Added CJS/ESM compatibility to supported features list

---

## [1.5.6] - 2026-02-19

### 🔧 Changed

- **CJS compatibility** — Added `require` entries for all subpath exports (`./assertions`, `./testing`, `./integrations/*`, `./matchers`). CJS consumers no longer need custom resolve configuration.

---

## [1.5.5] - 2026-02-19

### ✨ Added

#### Gate semantics (PASS / WARN / FAIL)

- **`--warnDrop <n>`** — Introduce a WARN band when score drops > `warnDrop` but < `maxDrop`
- **Gate verdicts:** PASS, WARN, FAIL
- **Profiles:** `strict` (warnDrop: 0), `balanced` (warnDrop: 1), `fast` (warnDrop: 2)
- **`--fail-on-flake`** — Fail the gate if unknown case is flagged as flaky (partial pass rate across determinism runs)

#### Determinism & flake intelligence

- **Adaptive variance thresholds** — Determinism audit passes if `absVariance ≤ 5` OR `relVariance ≤ 2%`
- **Per-case variance reporting** — Reports per-case pass rate across N runs and flags `[FLAKY]` cases
- **Golden dataset regression** — Added `evals/golden` with `pnpm eval:golden` to prevent semantic regressions
- **Golden drift output** — Writes `evals/golden/golden-results.json` with `currentScore`, `baselineScore`, `delta`, `passed`, and timestamps

#### CI audits & workflows

- **Nightly audits** — Added `audit-nightly.yml` for determinism + performance budgets (skips without `OPENAI_API_KEY`)
- **SDK compatibility matrix** — Added `sdk-compat.yml` to validate older SDK versions against current API
- **New audits:** `audit:retention`, `audit:migrations`, `audit:performance`, `audit:determinism`

#### Platform safety & governance (docs + proofs)

- **Audit trail docs** — Added `docs/audit-trail.md`
- **Observability docs** — Added `docs/observability.md` (log schema + requestId)
- **Retention docs** — Added `docs/data-retention.md`
- **Migration safety docs** — Added `docs/migration-safety.md`
- **Adoption benchmark** — Added `docs/adoption-benchmark.md`
- **Examples** — Added real-world example suites (RAG regression + agent tool-use)

### 🔧 Changed

- **Exit codes updated** — 0=pass, **8=warn**, failures remain as documented for score/regression/policy/API/config
- **GitHub + human formatters** — Render WARN state, top contributors, and flake indicators where available
- **Rate limiting** — Adds `Retry-After` header on 429 responses
- **RequestId propagation** — `EvalAIError` surfaces `requestId` from response body or `x-request-id` header

### 🧪 Testing

- Added tests for:
  - access boundaries (no tenant info leak)
  - rate-limit abuse patterns + `Retry-After`
  - executor failure modes (timeouts / upstream 429 / malformed responses)
  - error catalog stability + graceful handling of unknown codes
  - exports contract (retention visibility, 410 semantics)

---

## [1.5.0] - 2026-02-18

### ✨ Added

#### evalai CLI — CI DevX

- **`--format github`** — GitHub Actions annotations + step summary (`$GITHUB_STEP_SUMMARY`)
- **`--format json`** — Machine-readable output only
- **`--onFail import`** — On gate failure, import run metadata + failures to dashboard (idempotent per CI run)
- **`--explain`** — Show score breakdown (contribPts) and thresholds
- **`evalai doctor`** — Verify CI setup (config, API key, quality endpoint, baseline)
- **Pinned CLI invocation** — Use `npx -y @pauly4010/evalai-sdk@^1` for stable CI (avoids surprise v2 breaks)

#### Documentation

- **README** — 3-section adoption flow: 60s local → optional CI gate → no lock-in
- **Init output** — Shows path written, pinned snippet with `--format github --onFail import`
- **openAIChatEval** — "Gate this in CI" hint uses pinned invocation

### 🔧 Changed

- **evalai init** — Output: "Wrote evalai.config.json at {path}", one next step, uninstall line
- **Baseline missing** — Treated as config failure (BAD_ARGS), not API error
- **parseArgs** — Returns `{ ok, args }` or `{ ok: false }` (no `process.exit` inside) for testability

### 📦 Internal

- Refactored `check.ts` into modules: `api.ts`, `gate.ts`, `report/build-check-report.ts`, `formatters/`
- Deterministic helpers: `truncateSnippet`, `sortFailedCases`
- Formatter tests: `json.test.ts`, `github.test.ts`
- Doctor tests: `doctor.test.ts`

---

## [1.4.1] - 2026-02-18

### ✨ Added

- **evalai check `--baseline production`** — Compare against latest run tagged with `environment=prod`
- **Baseline missing handling** — Clear failure when baseline not found and comparison requested

### 🔧 Changed

- **Package hardening** — `files`, `module`, `sideEffects: false` for leaner npm publish
- **CLI** — Passes `baseline` param to quality API for deterministic CI gates

---

## [1.3.0] - 2025-10-21

### ✨ Added

#### Performance Optimizations

- **Client-side Request Caching**: Automatic caching of GET requests with smart TTL
  - Configurable cache size via `config.cacheSize` (default: 1000 entries)
  - Automatic cache invalidation on mutations (POST/PUT/DELETE/PATCH)
  - Intelligent TTL based on data type (automatic)
  - Cache hit/miss logging in debug mode
  - Advanced: Manual cache control available via `RequestCache` class for power users

- **Cursor-based Pagination**: Modern pagination utilities for efficient data fetching
  - `PaginatedIterator` class for easy iteration over all pages
  - `autoPaginate()` async generator for streaming individual items
  - `encodeCursor()` / `decodeCursor()` for pagination state management
  - `createPaginationMeta()` helper for response metadata
  - Works in both Node.js and browser environments

- **Request Batching**: Combine multiple API requests for better performance
  - Configurable batch size via `config.batchSize` (default: 10)
  - Configurable batch delay via `config.batchDelay` (default: 50ms)
  - Automatic batching for compatible endpoints
  - `RequestBatcher` class for custom batching logic
  - Reduces network overhead by 50-80% for bulk operations

- **Connection Pooling**: HTTP keep-alive for connection reuse
  - Enable via `config.keepAlive` option (default: true)
  - Reduces connection overhead for sequential requests
  - Improves performance for high-frequency API usage

- **Enhanced Retry Logic**: Already had exponential backoff, now fully configurable
  - Choose between 'exponential', 'linear', or 'fixed' backoff strategies
  - Configure retry attempts via `config.retry.maxAttempts`
  - Customize retryable error codes

#### Developer Experience

- **Comprehensive Examples**: New example files with real-world usage patterns
  - `examples/performance-optimization.ts`: All performance features demonstrated
  - `examples/complete-workflow.ts`: End-to-end SDK usage guide
  - Examples show caching, batching, pagination, and combined optimizations

- **New Configuration Options**:
  ```typescript
  new AIEvalClient({
    enableCaching: true, // Enable request caching
    cacheSize: 1000, // Max cache entries
    enableBatching: true, // Enable request batching
    batchSize: 10, // Requests per batch
    batchDelay: 50, // ms to wait before processing batch
    keepAlive: true, // Enable connection pooling
  });
  ```

### 🔧 Changed

- Updated `ClientConfig` interface with performance options
- Enhanced `request()` method with automatic caching and invalidation
- Improved TypeScript types for pagination utilities
- SDK description updated to reflect performance optimizations

### 📚 Documentation

- Added detailed performance optimization guide
- Created complete workflow documentation
- Updated README with new features and configuration options
- Added JSDoc comments for all new utilities

### 🚀 Performance Improvements

- **50-80% reduction** in network requests through batching
- **30-60% faster** repeated queries through caching
- **20-40% lower** latency for sequential requests through connection pooling
- **Automatic optimization** with zero code changes (backward compatible)

## [1.2.2] - 2025-10-20

### 🐛 Fixed

#### Additional Browser Compatibility Fixes

- **process.env Access**: Added safe `getEnvVar()` helper function for browser compatibility
  - Client constructor now works in browsers without `process.env`
  - `AIEvalClient.init()` now safe in browsers
  - Falls back gracefully when environment variables are not available
- **Type Name Collision**: Renamed test suite types to avoid confusion
  - `TestCase` → `TestSuiteCase` (for test suite definitions)
  - `TestCaseResult` → `TestSuiteCaseResult`
  - Legacy type aliases provided for backward compatibility
  - API `TestCase` type (from types.ts) remains unchanged
  - Removed duplicate `TestCase` export from main index to prevent TypeScript errors

#### TypeScript Compilation Fixes

- **AsyncLocalStorage Type Error**: Fixed `TS2347` error in `context.ts`
  - Removed generic type argument from dynamically required `AsyncLocalStorage`
  - Now compiles without errors in strict mode
- **Duplicate Identifier**: Fixed `TS2300` error for `TestCase` in `index.ts`
  - Resolved export collision between test suite and API types
  - Use `TestSuiteCase` for test definitions, `TestCase` for API responses

### 📚 Documentation

- Updated `AIEvalClient.init()` JSDoc with browser usage examples
- Added deprecation notices for legacy test suite type names
- Clarified environment variable behavior (Node.js only)

### 🔄 Migration Notes

No breaking changes! Legacy type names are aliased for backward compatibility:

- `TestCase` still works (aliased to `TestSuiteCase`)
- `TestCaseResult` still works (aliased to `TestSuiteCaseResult`)

**Recommended**: Update to new type names to avoid future deprecation:

```typescript
// OLD (still works, but deprecated)
import { TestCase } from "@pauly4010/evalai-sdk";

// NEW (recommended)
import { TestSuiteCase } from "@pauly4010/evalai-sdk";
```

---

## [1.2.1] - 2025-01-20

### 🐛 Fixed

#### Critical Bug Fixes

- **CLI Import Paths**: Fixed imports in CLI to use compiled paths (`../client.js`) instead of source paths (`../src/client`)
- **Duplicate Traces**: Fixed OpenAI and Anthropic integrations creating duplicate trace entries. Now creates a single trace with the final status
- **Commander.js Syntax**: Fixed invalid nested command structure (`eval` -> `run` to `eval:run`)
- **Context System Browser Compatibility**: Replaced Node.js-only `AsyncLocalStorage` with environment-aware implementation
  - Node.js: Uses `AsyncLocalStorage` for true async context propagation
  - Browser: Uses stack-based approach with helpful limitations documented
- **Path Traversal Security**: Added comprehensive security checks to snapshot path sanitization
  - Prevents empty names
  - Prevents path traversal attacks (`../`)
  - Validates paths stay within snapshot directory
  - Sanitizes to alphanumeric, hyphens, and underscores only

#### Developer Experience Improvements

- **Environment Detection**: Added runtime checks for Node.js-only features
  - `snapshot.ts` - Throws helpful error in browsers
  - `local.ts` - Throws helpful error in browsers
  - `context.ts` - Gracefully degrades in browsers
- **Empty Exports Removed**: Removed misleading empty `StreamingClient` and `BatchClient` objects
  - Now exports actual implementations: `batchProcess`, `streamEvaluation`, `batchRead`, `RateLimiter`
- **Error Handling**: Integration wrappers now catch and ignore trace creation errors to avoid masking original errors

### 📦 Changed

#### Dependencies

- **Updated**: `commander` from `^12.0.0` to `^14.0.0`
- **Added**: Peer dependencies (optional)
  - `openai`: `^4.0.0`
  - `@anthropic-ai/sdk`: `^0.20.0`
- **Added**: Node.js engine requirement `>=16.0.0`

#### Package Metadata

- **Version**: Bumped to `1.2.1`
- **Keywords**: Added `openai` and `anthropic`

### 📚 Documentation

#### README Updates

- **Environment Support Section**: New section clarifying Node.js vs Browser features
  - ✅ Works Everywhere: Core APIs, assertions, test suites
  - 🟡 Node.js Only: Snapshots, local storage, CLI, file exports
  - 🔄 Context: Full support in Node.js, basic in browsers
- **Changelog**: Updated with v1.2.1 fixes
- **Installation**: Unchanged
- **Examples**: All existing examples remain valid

#### Code Documentation

- Added JSDoc warnings to Node.js-only modules
- Added inline comments explaining environment checks
- Updated integration examples to reflect single-trace behavior

### 🔒 Security

- **Path Traversal Prevention**: Multiple layers of validation in snapshot system
- **Input Sanitization**: Comprehensive name validation before filesystem operations
- **Directory Boundary Enforcement**: Prevents writing outside designated directories

### ⚡ Performance

- **Reduced API Calls**: Integration wrappers now make 1 trace call instead of 2
- **Faster Errors**: Environment checks happen at module load time

### 🔄 Migration Guide from 1.2.0 to 1.2.1

#### No Breaking Changes! ✅

All fixes are backward compatible. However, you may notice:

1. **Integration Tracing**: You'll see fewer trace entries (1 per call instead of 2)
   - **Before**: `pending` trace → `success` trace (2 entries)
   - **After**: `success` trace (1 entry)

2. **CLI Command**: Use `evalai eval:run` instead of `evalai eval run`
   - Old syntax will fail, update your scripts

3. **Browser Usage**: Node.js-only features now throw helpful errors

   ```javascript
   // In browser:
   import { snapshot } from "@pauly4010/evalai-sdk";
   snapshot("test", "name"); // ❌ Throws: "Snapshot testing requires Node.js..."
   ```

4. **Context in Browsers**: Limited async propagation
   ```javascript
   // Works in both Node.js and browser, but browser has limitations
   await withContext({ userId: "123" }, async () => {
     await client.traces.create({ name: "test" });
     // Node.js: ✅ Full context propagation
     // Browser: ⚠️ Basic context, not safe across all async boundaries
   });
   ```

#### Recommended Actions

1. **Update CLI scripts** if using `evalai eval run`
2. **Test browser builds** if using SDK in browsers
3. **Review trace counts** if you have monitoring based on trace volume
4. **Update dependencies**: Run `npm update @pauly4010/evalai-sdk`

### 🧪 Testing

All fixes have been:

- ✅ Syntax validated
- ✅ Import paths verified
- ✅ Security tests for path traversal
- ✅ Environment detection tested
- ✅ No linting errors

---

## [1.2.0] - 2025-10-15

### 🎉 Added

- **100% API Coverage** - All backend endpoints now supported
- **Annotations API** - Complete human-in-the-loop evaluation
- **Developer API** - Full API key and webhook management
- **LLM Judge Extended** - Enhanced judge capabilities
- **Organizations API** - Organization details access
- **Enhanced Types** - 40+ new TypeScript interfaces

---

## [1.1.0] - 2025-01-10

### ✨ Added

- Comprehensive evaluation template types
- Organization resource limits tracking
- `getOrganizationLimits()` method

---

## [1.0.0] - 2025-01-01

### 🎉 Initial Release

- Traces, Evaluations, LLM Judge APIs
- Framework integrations (OpenAI, Anthropic)
- Test suite builder
- Context propagation
- Error handling & retries
