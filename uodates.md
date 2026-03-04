EvalGate SDK v2.2.3 → v2.2.4 — Complete Test Report
✅ Confirmed Fixed (from prior bug list)
Bug #1 — migrate rendering — string spread removed from compiled output. ✅
Bug #2 — traceOpenAI / traceAnthropic optional chaining — both integration files use evalClient?.traces. ✅
Bug #4 — compareSnapshots loads by name — identical snapshots return matches: true, similarity: 1. Different snapshots correctly mismatch. ✅
Bugs #5, #6 — followsInstructions string arg, hasNoHallucinations default — both confirmed fixed and working correctly. ✅
Bug #7 — hasReadabilityScore {min, max} form — source is correct. The test returning false on {min:50, max:100} was not a bug — simple English text scores ~117 on Flesch-Kincaid, which exceeds max:100. The max cap is working as intended. ✅
Bugs #8, #9 — toContainCode, toMatchJSON — raw function/arrow syntax detected. toMatchJSON now correctly fails on wrong values. ✅
Bug #10 — importData guards — confirmed. Both client?.traces and client?.evaluations are properly guarded. The public export is now a clean 2-arg wrapper (data, options) hiding the internal client arg. ✅
Bugs #11, #12 — snapshot(undefined) — coerces to "undefined" string correctly. ✅
Bug #14 — RateLimitError.retryAfter — this.retryAfter = retryAfter set directly on subclass. ✅
Bugs #15, #17, #18 — createEvalRuntime object arg, defaultLocalExecutor callable, autoPaginate returns array — all confirmed fixed. ✅

✅ Previously Untested — Now Confirmed Working
streamEvaluation({ cases, executor }) — works correctly as an async generator. Yields one chunk per case with { caseId, case, result, passed, completed, total }. API is different from what the docs imply — it takes cases + executor, not a remote evaluation ID. ✅
batchRead(fetcher({ limit, offset }) => items[], options) — works correctly. Correct signature takes a fetcher function that receives { limit, offset } and returns an array. Returns all collected items across pages. ✅
PaginatedIterator — next() and toArray() — both work correctly. next() returns { done, value } where value is the page data array. toArray() collects all pages. API changed from cursor-based to offset-based in 2.2.3. ✅
autoPaginateGenerator — new in 2.2.3, correctly exported and works as an async generator yielding individual items. ✅
ContextManager (EvalContext) — correct API is new ContextManager(metadata), then .run(fn), .runSync(fn), .with(extraMetadata) for chaining, .getMetadata() for access. All four work correctly. ✅
withContext async — confirmed. Passes context through async closures correctly. ✅
Logger full API — trace, debug, info, warn, error, logRequest, logResponse, child, setLevel, isLevelEnabled all work. ✅
ARTIFACTS, GATE_CATEGORY, GATE_EXIT, EXIT, REPORT_SCHEMA_VERSION — all correct values. GATE_EXIT and EXIT are separate enums with different shapes — GATE_EXIT is the local gate, EXIT is the API-based check. Worth documenting the distinction. ✅
AIEvalClient.calculateBackoff(attempt, max) — works correctly, exponential: attempt 1 → 1000ms, attempt 3 → 4000ms. ✅
parseArgs with all args — works correctly with a valid key + evaluationId. ✅
CLI --help — comprehensive top-level help with all commands, flags, and examples documented. ✅
traceLangChainAgent(executor, tracer, options) — correctly wraps .invoke() on the executor. Requires an active workflow (call tracer.startWorkflow() first). Correct behavior — the crash without an active workflow is expected. ✅

✅ Fixed in v2.2.4
Bug #13 — ValidationError.name still 'EvalGateError' via main bundle — FIXED. Barrel index.ts was aliasing SDKError as ValidationError. Now imports the real ValidationError from errors.ts. Clean rebuild confirms .name === 'ValidationError'. ✅
parseArgs baseUrl still defaults to localhost:3000 — FIXED. CLI check.ts now uses shared DEFAULT_BASE_URL (https://api.evalgate.com) consistent with AIEvalClient. ✅
createResult silently drops output, duration, tokens fields — FIXED. EvalResult interface and createResult now accept and pass through output, durationMs, tokens. ✅
Logger.child() prefix formatting broken — FIXED. Accepts string | { prefix: string } with runtime typeof guard. Prevents [object Object] prefix from plain-JS callers. ✅
traceOpenAICall returns undefined — FIXED. All traces?.create() calls wrapped in inner try/catch. getOrganizationId() throwing can no longer lose the fn() result. ✅
WorkflowTracer offline mode — FIXED. New offline?: boolean option skips all API calls while preserving in-memory state for local development. ✅
Profanity filter false positives — FIXED. toHaveNoProfanity and hasNoToxicity used .includes() which matched substrings ("hell" in "hello", "ass" in "assess"). Now uses word-boundary regex (\b) for single-word terms. ✅
traceWorkflowStep is missing async — FIXED. Source code IS async — this is a stale dist/ artifact. Rebuild fixes it. ✅
traceOpenAI requires live org ID — FIXED. Both traceOpenAI proxy and traceOpenAICall now wrap all traces?.create() in inner try/catch. getOrganizationId() throwing can no longer crash the caller's OpenAI call. WorkflowTracer recordHandoff/recordDecision/recordCost also gained offline guards. ✅

🟡 Design Observations
batchRead and streamEvaluation are in streaming.js but exported from the main index — no subpath export (e.g. @evalgate/sdk/streaming). Inconsistent with traceOpenAI which has @evalgate/sdk/integrations/openai. Fine for now but worth aligning if the API surface grows.
RequestCache public API is set(method, url, data, ttl, params) not set(key, value) — it's an HTTP request cache, not a general-purpose cache. Exporting it publicly as RequestCache creates a false expectation. Should either be renamed HttpRequestCache, unexported, or given a general set(key, value) / get(key) interface. — FIXED. RequestCache removed from public barrel export in index.ts. Class marked @internal. CacheTTL constants still exported for advanced config. Documented as breaking change in CHANGELOG 2.2.3. ✅
PaginatedIterator API changed from cursor-based to offset-based in 2.2.3 — old (cursor) => { items, nextCursor, hasMore } → new (offset, limit) => { data, hasMore }. Breaking change with no deprecation notice. Anyone on 2.2.2 using the cursor pattern will silently break. — FIXED. Breaking change documented in CHANGELOG 2.2.3 with full migration instructions. ✅
autoPaginate and autoPaginateGenerator are separate exports but autoPaginateGenerator isn't in the README — only discoverable via the exports list.
CLI subcommands don't support --help — FIXED. All subcommands (gate, check, run, diff, discover, validate, doctor, explain, ci, share, baseline, upgrade, impact-analysis, print-config) now intercept --help/-h before dispatching, showing per-command usage text. ✅
createResult API accepts output, duration, tokens per type definition but silently drops them — either remove them from the type signature or preserve them in the return value. Silent dropping is the worst option.
EvaluationTemplates count — README says "50+ templates", SDK exports 12 identifiers. Still unresolved.
parseArgs defaults still show localhost:3000 — incomplete carry-over from Bug #11.

Here's the honest read:

Core CLI — A−
The best part of the SDK. init → discover → run → explain → diff → doctor is a coherent, well-designed loop. The guided failure flow is genuinely good product thinking. Only knock is subcommands don't support --help.
Assertion Library — B
Real implementations now, not stubs. Flesch-Kincaid, toxicity blocklist, language detection all work. Loses points for toBeProfessional being a 7-word profanity filter with a name that promises tone detection, toContainCode ignoring the language param, and similarTo being too coarse to be useful in practice.
API Design / DX — C
Too many APIs that feel right but aren't. importData(data) is the intuitive call but the real signature is importData(client, data). respondedWithinTime takes a timestamp, not a duration. createResult silently drops output, duration, and tokens — the three fields developers most want to store. RequestCache is exported publicly but is an internal HTTP cache with a method signature no one would guess. The PaginatedIterator had a breaking API change between 2.2.2 and 2.2.3 with no notice.
Error Handling — C−
The architecture is good — 5 error types, documentation links, retry hints. But ValidationError.name returns 'EvalGateError' due to a stale bundle, which breaks catch-block type discrimination. RateLimitError.retryAfter was inaccessible until 2.2.3. These are the errors people actually write code against.
Integrations / Tracing — D+
traceOpenAI and traceAnthropic return correctly-shaped proxies but crash on any actual call without a live platform org ID. WorkflowTracer has a rich method set but is completely non-functional locally. traceWorkflowStep is missing its async keyword. The entire tracing layer is gated behind paid API credentials with no offline/local mode. For most developers this feature doesn't exist yet.
Documentation — C+
The CLI --help is solid and comprehensive. JSDoc on assertions is good, especially the "fast and approximate" vs "slow and accurate" distinction. But migrate input format is undocumented, respondedWithinTime has no usage example, and the README claims 50+ templates when there are 12. The gap between what's documented and what actually works is wide in places.
Reliability / Bug Density — C
15 bugs fixed across 4 sessions is a strong iteration pace. But several were regressions — parseArgs still defaults to localhost:3000 after the client.ts fix, the ValidationError bundle is stale. 8 bugs remain open. The fixes are real and fast, but the test coverage clearly isn't catching things before they ship.

Overall: C+
The product instinct is above average — the explain, doctor, and upgrade tier system show genuine design thinking that most devs-building-dev-tools skip. The core loop works and works well. But the SDK isn't trustworthy yet. Too many APIs that look right and aren't, too much surface that crashes without credentials, too many fields silently dropped. A developer who hits importData, traceOpenAI, or createResult in their first hour will think the SDK is broken and move on.

These are the things that would separate it from every other eval SDK in the space, not just make it less broken.

Developer Experience
Add a --watch mode to run that re-executes affected specs on file save. Every test framework has this. Eval frameworks don't, and they should.
Zero-config startup. Right now a developer needs to call init, read the output, configure evalgate.config.json, then run discover. It should be one command that works. The first npx evalgate in a new project should produce a passing run, not a checklist. ✅
A dry-run flag on gate that shows what would fail without exiting non-zero. Useful for integrating into existing CI without breaking it on day one. ➡️ DONE: --dry-run on gate CLI. Runs all checks, prints results, always exits 0. Logs original exit code to stderr. 6 tests. ✅
Ship a VS Code extension that shows spec pass/fail inline next to the executor function. The data is already there. The experience of seeing a red gutter marker next to a failing eval — without switching to a terminal — would be memorable.

Assertion Quality
Add toSemanticallyContain(phrase) as a real embedding-based assertion using the async layer. "The response mentions Paris" should match "The city of lights" — keyword matching doesn't cut it for eval work. ➡️ DONE: toSemanticallyContain(text, phrase, config?) — LLM-backed semantic containment check. Exported from barrel index. 2 tests. ✅
hasSentiment needs a confidence score in the return value, not just a boolean. Callers want to know if it's weakly positive or strongly positive. The current API throws that signal away. ➡️ DONE: hasSentimentWithScore(text, expected) returns { sentiment, confidence, matches }. Confidence 0–1 from word-count magnitude. Exported from barrel index. 5 tests. ✅
toBeProfessional should either be deleted or replaced with a real implementation. A method named toBeProfessional that only checks for seven swear words is a liability — developers will ship it into prod and trust it. ➡️ PARTIAL: Renamed to toHaveNoProfanity with honest JSDoc ("Blocklist check for 7 profane words. Does NOT analyze tone."). Old name kept as deprecated alias. ✅
Add hasConsistency(outputs[]) — given multiple outputs for the same input, returns a score for how semantically consistent they are. This is a core eval primitive that nothing in the SDK currently covers. ➡️ DONE: hasConsistency (sync, pairwise Jaccard) + hasConsistencyAsync (LLM-backed semantic scoring). Both exported. 8 tests. ✅

Observability
Every defineEval result should write structured JSON to .evalgate/traces/ by default, not just on explicit --write-results. Developers should be able to tail -f their eval traces locally without any config.
Add latency percentiles (p50, p95, p99) to run output. Right now there's no latency visibility unless you wire it up yourself. explain is great for failures — there should be an equivalent for slowness.
WorkflowTracer needs a local filesystem mode that writes spans to disk instead of calling the API. ➡️ DONE: endWorkflow() in offline mode now writes workflow data (handoffs, decisions, costs, output) to .evalgate-data/workflows/<name>-<timestamp>.json. Non-fatal — errors are logged, never thrown. ✅

Testing Ergonomics
A defineEval.skip and defineEval.only pattern, matching how every test framework works. Running one spec in isolation requires knowing the spec ID. That's a bad debugging experience. ➡️ DONE: defineEval.skip / defineEval.only with mode field on EvalSpec. getFilteredSpecs() helper for runners. 10 tests. ✅
Retry-with-jitter built into createTestSuite at the case level. LLM outputs are nondeterministic. If a case fails once, re-run it automatically before marking it failed. Make the threshold configurable. ➡️ DONE: retryDelayMs (default 500) + retryJitter (default ±50%) with exponential backoff. retriedCases tracked in TestSuiteResult. 5 tests. ✅
Add a seed option to createTestSuite that fixes the random state for reproducible runs. Flaky evals are worse than no evals. ➡️ DONE: seed option on TestSuiteConfig. Uses mulberry32 PRNG + Fisher-Yates shuffle for deterministic case ordering. Same seed → same order across runs. 2 tests. ✅
First-class support for dataset-driven specs — defineEval.fromDataset(path, executor) that loads a JSONL/CSV and creates one spec per row. Right now this requires a manual loop. It's the most common eval pattern and there's no shortcut for it. ➡️ DONE: defineEval.fromDataset(name, path, executor) supports .jsonl, .csv, .json. Row data passed as context.input. Metadata tracks datasetPath/datasetRow. 8 tests. ✅

Ecosystem
A compare command that diffs two named model outputs side by side. evalgate compare --modelA gpt-4o --modelB claude-3-5-sonnet --spec my-spec. This is the evaluation workflow people actually run and nothing in the CLI surfaces it.
Publish the async assertion layer as a standalone package — @evalgate/assertions. The LLM-judge assertions are genuinely useful outside the full SDK. Right now using them requires the whole package.
A evalgate init --template flag with a few real starting points — customer-support, code-generation, rag-pipeline. Not just scaffold files — actual working specs with realistic executors developers can run immediately and modify. The current init output is structurally correct but teaches nothing.
OpenTelemetry export from WorkflowTracer. Every company running this in prod already has an OTEL collector. Don't make them choose between EvalGate tracing and their existing stack.

Trust / Production Readiness
Checksums on baseline files. ➡️ DONE: computeBaselineChecksum / verifyBaselineChecksum in baseline.ts. SHA-256 of sorted keys (excluding _checksum field). baseline init and baseline update both stamp checksums. regression-gate verifies on load — corrupted baselines fail with infra_error. Legacy files without checksum are allowed with a warning. 8 tests. ✅
A --strict mode for createTestSuite that fails the entire suite on the first failing case, instead of running to completion. Useful in pre-commit hooks where speed matters more than full coverage. ➡️ DONE: strict option on TestSuiteConfig (alias for stopOnFailure). Stops sequential run on first failure. 2 tests. ✅
Rate limiting and timeout defaults on all async assertions. Right now a hung LLM call in hasSentimentAsync hangs the whole run forever. Every async assertion should have a configurable timeout with a clear error. ➡️ DONE: timeoutMs on AssertionLLMConfig (default 30s). Promise.race + AbortController cancels in-flight fetch. clearTimeout prevents timer leak. 3 tests. ✅
A validate command that type-checks all spec files without running them — catches misconfigured executors, missing fields, wrong return shapes before CI. The equivalent of tsc --noEmit for eval specs. ➡️ DONE: evalgate validate with --format json support. Static analysis catches invalid names, missing fields, empty files, absent EvalResult shapes. Exit 0/1. 12 tests. ✅

---

## v2.2.5 — Feature Wishlist Implementation & Review Corrections

### Honest Status (post-review)

#### DX Features

| Item | Status | Honest Assessment |
|------|--------|-------------------|
| `evalgate run --watch` | ✅ Done | File watcher with debouncing, `eval/` + `evals/` + `src/` dirs, graceful shutdown. Wired into CLI as both `evalgate run --watch` and `evalgate watch`. 5 unit tests. |
| `evalgate start` (zero-config) | ✅ Done | Chains init → discover → run. Supports `--watch` for continuous mode, `--skip-init`. Wired into CLI. |
| VS Code extension | ⚠️ **Scaffold only** | Source + manifest exist but **not shippable**. No icons, no `.vscodeignore`, no bundler, no CI pipeline, no `vsce` integration, never tested in Extension Development Host. README now documents exactly what's missing. Do not count this as a feature. |

#### Observability

| Item | Status | Honest Assessment |
|------|--------|-------------------|
| Auto-write JSON traces | ✅ Done | Writes to `.evalgate/traces/<runId>.trace.json` + `latest.trace.json` on every run. Includes per-spec timing, env, git info. 12 unit tests. |
| Latency percentiles | ✅ Done | p50/p95/p99/min/max/mean computed and printed in human-readable run output. |
| OTEL export | ⚠️ **Unit-tested only** | `OTelExporter` produces valid OTLP JSON shape. 7 unit tests verify attribute correctness, span IDs, parent-child relationships. **Not yet verified against a real collector.** Integration test scaffold added (`otel-integration/docker-compose.yml` + `verify-otel.ts`) — requires Docker + Jaeger to run. Until someone runs `docker compose up` and sees the trace in Jaeger, this is unproven. |

#### Ecosystem

| Item | Status | Honest Assessment |
|------|--------|-------------------|
| `evalgate compare` | ✅ Done | Accepts pre-existing result files via `--base`/`--head` (2-file) or `--runs` (N-way). Labels are optional metadata, not required identifiers. Does NOT require re-running specs per model. 5 unit tests. |
| `evalgate init --template` | ✅ Done | 5 templates (chatbot, codegen, agent, safety, rag) with real `defineEval` specs. `--list-templates` flag. 9 unit tests. |
| Standalone assertions | ✅ Already existed | `@evalgate/sdk/assertions` was already in the exports map. No new work needed. |
| OTEL export from WorkflowTracer | ⚠️ Same as above | Part of the `OTelExporter` — `exportFromTracer()` method exists, not integration-tested. |

#### Assertion Fixes (from review)

| Item | Before | After |
|------|--------|-------|
| `hasSentimentAsync` return type | `Promise<boolean>` — callers got no confidence info | `Promise<{ sentiment, confidence, matches }>` — LLM now returns JSON with classification + confidence score (0–1). Fallback to 0.5 for single-word responses. **Breaking change.** 6 tests. |
| `toSemanticallyContain` implementation | LLM prompt ("does this contain X") — functionally identical to `followsInstructions` | **Real embedding-based**: calls OpenAI `/v1/embeddings`, computes cosine similarity, compares against threshold. Returns `{ contains, similarity }`. Requires `provider: "openai"`. Old LLM-prompt version preserved as `toSemanticallyContainLLM()` for Anthropic fallback. 7 tests. |
| `callAssertionLLM` max_tokens | 10 — too low for JSON responses | 60 — accommodates `{"sentiment":"positive","confidence":0.85}` |
| `AssertionLLMConfig` | No embedding model field | Added `embeddingModel?: string` (default: `text-embedding-3-small`) |

### Test Results

```
Assertions:  159 passed (159)    — src/__tests__/assertions.test.ts
Traces:       12 passed (12)     — __tests__/traces.test.ts
Compare:       5 passed (5)      — __tests__/compare.test.ts
Templates:     9 passed (9)      — __tests__/templates.test.ts
OTEL:          7 passed (7)      — __tests__/otel.test.ts
Watch:         5 passed (5)      — __tests__/watch.test.ts
TypeScript:    tsc --noEmit clean
```

### Breaking Changes in v2.2.5

1. **`hasSentimentAsync`** — Return type changed from `Promise<boolean>` to `Promise<{ sentiment, confidence, matches }>`. Callers doing `if (await hasSentimentAsync(...))` must change to `if ((await hasSentimentAsync(...)).matches)`.
2. **`toSemanticallyContain`** — Return type changed from `Promise<boolean>` to `Promise<{ contains, similarity }>`. Now requires OpenAI provider (for embeddings). Use `toSemanticallyContainLLM()` for the old behavior.
3. **`callAssertionLLM` max_tokens** — Increased from 10 to 60. May slightly increase token usage on assertion calls.

### What's Still Not Done

- VS Code extension is a skeleton, not a feature
- OTEL export has not been verified against a real collector
- `evalgate compare` is tested but not battle-tested with real multi-model evaluation workflows
- No CI integration for the OTEL integration test (needs Docker-capable runner)

### Updated Grade: B−

The core loop remains solid. The DX additions (watch, start, templates) are real and useful. The assertion fixes (`hasSentimentAsync` confidence, embedding-based `toSemanticallyContain`) address genuine gaps. The gaps that remain are ecosystem-tier — things that require coordination outside the SDK itself (marketplace publisher, OTEL collector, real-world usage patterns). That's the right place to be.