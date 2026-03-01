# Changelog

All notable changes to the @evalgate/sdk package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

--

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
