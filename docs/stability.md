# Stability Matrix

> Last updated: 2026-03-09

This document classifies every major feature by maturity level and provides API compatibility guarantees for each tier.

## Maturity Tiers

| Tier | Meaning | API Compatibility Promise |
|------|---------|--------------------------|
| **Stable** | Production-ready, tested, unlikely to change shape | Breaking changes only in major versions. Minimum 90 days deprecation notice. |
| **Beta** | Functional and usable, may refine behaviour or payload shape | May change in minor versions. 30 days notice for breaking changes. |
| **Alpha** | Experimental, available for feedback | Can change at unknown time without notice. |

---

## Feature Matrix

### Core Platform

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Evaluation CRUD | **Stable** | v1.0 | Create, read, update, delete evaluations |
| Test Cases (canonical `testCases` table) | **Stable** | v1.0 | `evaluationTestCases` deprecated |
| Evaluation Runs | **Stable** | v1.0 | Includes idempotency key support |
| Test Results | **Stable** | v1.0 | Per-test-case pass/fail + output |
| Organizations & Members | **Stable** | v1.0 | Multi-tenant isolation |

### Authentication & Authorization

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Session-based auth | **Stable** | v1.0 | Via better-auth |
| API key auth | **Stable** | v1.0 | SHA-256 hashed, scoped |
| `secureRoute` wrapper | **Stable** | v1.1 | Centralized enforcement |
| Role-based access (RBAC) | **Stable** | v1.2 | `Role` enum: viewer, member, admin, owner |
| Scope-based access (SBAC) | **Beta** | v1.2 | `requiredScopes` on routes; `scopesForRole()` mapping |
| Active org cookie (`active_org`) | **Beta** | v1.2 | `POST /api/org/switch` |

### Quality & Scoring

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Quality Score (0-100) | **Stable** | v1.1 | Composite: pass rate, safety, judge, schema, latency, cost |
| Aggregate Metrics Service | **Beta** | v1.2 | Computes real metrics from DB data |
| Confidence Bands (Wilson) | **Beta** | v1.2 | On trend data |
| Regression Detection | **Stable** | v1.1 | Compares against published baseline |

### CI/CD Integration

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| `evalgate check` CLI | **Stable** | v1.1 | `--minScore`, `--maxDrop`, `--format github|json|human`, `--onFail import`, `--explain` |
| `evalgate init` CLI | **Stable** | v1.4 | Full project scaffolder (detects PM, creates baseline, installs GH workflow) |
| `evalgate doctor` CLI | **Stable** | v1.5 | Verify CI setup (config, API key, quality endpoint) |
| `evalgate gate` CLI | **Stable** | v1.6 | Local regression gate with exit code taxonomy (0–4) |
| `evalgate baseline init\|update` | **Stable** | v1.6 | Create/update `evals/baseline.json` from real test runs |
| `--policy` flag | **Beta** | v1.2 | HIPAA, SOC2, GDPR, PCI_DSS, FINRA_4511 |
| `--baseline` flag | **Stable** | v1.4 | `published`, `previous`, or `production` |
| Standardized exit codes | **Stable** | v1.2 | 0-7 range, documented |

### Evaluation Executors

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| DirectLLM Executor | **Beta** | v1.1 | OpenAI + Anthropic |
| Webhook Executor | **Beta** | v1.1 | POST to customer endpoint |
| Trace-Linked Executor | **Alpha** | v1.1 | Score production traces |
| Heuristic Scoring (fallback) | **Stable** | v1.0 | Contains/regex/exact match |

### Versioning & Publishing

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Evaluation Versioning | **Beta** | v1.1 | Snapshot on publish, diff summary |
| Deterministic Snapshots | **Beta** | v1.2 | Stable sort, sorted keys |
| Draft/Published/Archived status | **Stable** | v1.1 | |

### Drift Detection

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Z-score drift detection | **Beta** | v1.1 | Quality, safety, cost dimensions |
| Drift Alerts (CRUD) | **Beta** | v1.1 | Acknowledge via PATCH |
| Scheduled detection job | **Alpha** | v1.1 | Needs cron/worker setup |

### Reports & Governance

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| HMAC-signed JSON reports | **Stable** | v1.1 | `hmac-sha256-v1` |
| Shareable report links | **Stable** | v1.1 | Token-based, expirable |
| Audit-defensible payload (v2) | **Beta** | v1.2 | Org info, snapshot hash, drift, policy |
| Audit Logs | **Beta** | v1.1 | Immutable, admin-only read |
| Governance Engine (server-side) | **Alpha** | v1.0 | HIPAA, SOC2, GDPR presets |

### Observability

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Traces & Spans | **Stable** | v1.0 | Unified `spans` table |
| Workflow Runs | **Stable** | v1.0 | Orchestration tracking |
| Agent Handoffs | **Beta** | v1.0 | Delegation, escalation, parallel |
| Agent Decisions | **Beta** | v1.0 | Audit trail for agent choices |
| Cost Records | **Stable** | v1.0 | Per-call token + cost tracking |
| LLM Judge | **Beta** | v1.0 | Meta-judge post-eval hook |

### SDK (`@evalgate/sdk`) — v3.1.0

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| `AIEvalClient` | **Stable** | v1.0 | Core client class |
| `WorkflowTracer` | **Stable** | v1.0 | Trace instrumentation |
| `createTestSuite` + `expect` | **Stable** | v1.0 | Testing DSL |
| `expect().not` modifier | **Stable** | v2.2 | Proxy-based negation for all assertion methods |
| Assertions library | **Stable** | v1.0 | 15+ assertion types |
| `hasPII(text)` | **Stable** | v2.2 | Semantic PII detection; `true` = PII found |
| `defineSuite` (object + positional) | **Stable** | v2.2 | Both call forms accepted |
| `snapshot(name, output)` | **Stable** | v2.2 | Accepts string or object; auto-serializes via JSON.stringify |
| `hasSentiment` / `hasNoToxicity` / `hasValidCodeSyntax` / `containsLanguage` / `hasFactualAccuracy` / `hasNoHallucinations` / `hasReadabilityScore` (sync) | **Stable** | v2.2.2 | Real heuristic implementations; marked **Fast and approximate** in JSDoc |
| `matchesSchema` | **Stable** | v2.2.2 | Handles JSON Schema `required` array, `properties` object, and simple key-presence template; backward compatible |
| `hasSentimentAsync` / `hasNoToxicityAsync` / `containsLanguageAsync` / `hasValidCodeSyntaxAsync` / `hasFactualAccuracyAsync` / `hasNoHallucinationsAsync` | **Beta** | v2.2.2 | LLM-backed async variants; marked **Slow and accurate**; require `configureAssertions` or per-call config |
| `configureAssertions(config)` / `getAssertionConfig()` | **Stable** | v2.2.2 | Global `AssertionLLMConfig` for async assertion variants |
| `importData(client, data, options?)` | **Stable** | v2.2.2 | `options` now optional (was required); prevents crash when called with 2 args |
| `compareWithSnapshot(name, output)` | **Stable** | v2.2.2 | Accepts `unknown` input; objects coerced via JSON.stringify |
| `WorkflowTracer` (no API key) | **Stable** | v2.2.2 | Defensive guard on `client.getOrganizationId`; no longer crashes without API key |
| `RequestCache` (default TTL) | **Stable** | v2.2.3 | `set()` defaults to `CacheTTL.MEDIUM`; entries no longer immediately stale when TTL is omitted |
| `autoPaginate(fetcher)` | **Stable** | v2.2.3 | Returns `Promise<T[]>` (flat array); was returning an unexhausted `AsyncGenerator` |
| `autoPaginateGenerator(fetcher)` | **Stable** | v2.2.3 | Streaming `AsyncGenerator<T[]>` for incremental page processing |
| `createEvalRuntime(config)` | **Stable** | v2.2.3 | Accepts `string \| { name?, projectRoot? }`; config-object overload previously silently ignored |
| `defaultLocalExecutor` | **Stable** | v2.2.3 | Re-exported as callable factory (`createLocalExecutor`); was a pre-constructed instance |
| `compareSnapshots(nameA, nameB, dir?)` | **Stable** | v2.2.3 | Loads both snapshots from disk and diffs them; replaces the incorrectly aliased `compareWithSnapshot` |
| `snapshot(name, undefined\|null)` | **Stable** | v2.2.3 | `undefined` and `null` outputs serialize to `"undefined"` / `"null"` instead of throwing |
| `toContainCode()` raw-code detection | **Stable** | v2.2.3 | Detects raw `function`, `const`, `class`, arrow, `import`/`export`, `return` without requiring a fenced block |
| `hasReadabilityScore({ min, max })` | **Stable** | v2.2.3 | Accepts `number \| { min?, max? }`; object form was previously coerced to `NaN` |
| `hasConsistency` / `hasConsistencyAsync` return `{ score, passed }` | **Stable** | v2.3 | Was `{ score, consistent }`; renamed for API consistency |
| `respondedWithinDuration` returns `AssertionResult` | **Stable** | v2.3 | Was `boolean`; now returns `{ name, passed, expected, actual, message }` |
| `respondedWithinTimeSince` returns `AssertionResult` | **Stable** | v2.3 | Was `boolean`; now returns `{ name, passed, expected, actual, message }` |
| `computeBaselineChecksum` / `verifyBaselineChecksum` | **Stable** | v2.3 | Now in main barrel; was only reachable via `cli/baseline` subpath |
| `resetSentimentDeprecationWarning` | **Stable** | v2.3 | Now in main barrel for testing deprecation behavior |
| Framework integrations | **Beta** | v1.0 | Jest, Vitest adapters |
| Regression gate exports | **Stable** | v1.6 | `@evalgate/sdk/regression` |
| Behavioral spec discover/run/diff | **Beta** | v2.0 | `evalgate discover`, `run`, `diff`, `ci` pipeline |

### EvalGate Intelligence Layer — v3.0.1

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| **Trace Schema + Validator** | **Beta** | v2.1 | Zod v1, versioned, `TRACE_MIN_SUPPORTED_VERSION` compat check |
| **Trace Freezer** | **Beta** | v2.1 | `Object.freeze` deep structural immutability |
| **Failure Taxonomy** | **Stable** | v2.1 | 8 categories: hallucination, refusal, format_error, reasoning_failure, tool_misuse, compliance_violation, latency_spike, cost_overrun |
| **Failure Confidence** | **Beta** | v2.1 | Weighted multi-detector aggregation, agreement ratio, `agreementRatio` field |
| **Rule-Based Detector** | **Beta** | v2.1 | Pattern matching for each failure category |
| **EvalCase spec (v1)** | **Beta** | v2.1 | Canonical test case format; 64-bit FNV-1a stable content-hash ID (`ec_<16 hex>`) |
| **Test Generator** | **Beta** | v2.1 | EvalCase generation from behavioral traces; refusal/format/precision constraints |
| **Deduplicator** | **Beta** | v2.1 | Jaccard similarity clustering; `MAX_PAIRWISE_N=500` O(n²) guard |
| **Test Quality Evaluator** | **Beta** | v2.1 | Coverage, uniqueness, and signal-strength scores per EvalCase |
| **Trace Minimizer** | **Beta** | v2.1 | Removes non-essential spans while preserving failure signal |
| **Dataset Coverage Model** | **Beta** | v2.1 | Cluster-based gap detection; configurable `seedPhrases`; exports `DEFAULT_GAP_SEED_PHRASES` |
| **Three-Layer Scoring** | **Beta** | v2.1 | Reasoning layer, Action layer, Outcome layer; each with `evidenceAvailable` flag |
| **Multi-Judge Aggregation** | **Beta** | v2.1 | 6 strategies; `majority_vote` tie → 0.5; `agreementStats` with stdDev + outlierJudgeIds |
| **Judge Transparency** | **Beta** | v2.1 | Per-judge audit trail with rationale and timing |
| **Metric DAG Safety** | **Beta** | v2.1 | Cycle detection, missing `finalScore` node, undefined inputs, max depth (10), reachability |
| **Behavioral Drift** | **Beta** | v2.1 | 6 signal types (cot_usage_drop/spike, confidence_drop, tool_call_drop, retrieval_drop, error_spike) |
| **Drift Explainer** | **Alpha** | v2.1 | Human-readable drift narrative from signals |
| **Replay Determinism** | **Beta** | v2.1 | SHA-256 input canonicalization for reproducible replay |
| **Regression Attribution** | **Beta** | v2.1 | Scores diff signals (git, model, prompt, tool schema, dataset, judge) to rank regression causes |

### EvalGate UX Components — v3.0.1

| Component | Tier | Since | Notes |
|-----------|------|-------|-------|
| `ScoreLayerBreakdown` | **Beta** | v2.1 | Reasoning/action/outcome progress bars; composite score; estimated badge |
| `JudgeVotePanel` | **Beta** | v2.1 | Per-judge pass/partial/fail icons; agreement %; strategy label; confidence badge |
| `DriftSeverityBadge` | **Beta** | v2.1 | none → low → medium → high → critical; optional signal list |
| `CoverageGapList` | **Beta** | v2.1 | Gap importance bars; coverage ratio; maxVisible prop; overflow count |
| `FailureConfidenceBadge` | **Beta** | v2.1 | Category label; confidence %; optional detector agreement count |

### Database

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| Integer timestamps (auth tables) | **Stable** | v1.2 | user, session, account, verification, organizations |
| Integer timestamps (hot-path) | **Stable** | v1.7 | evaluationRuns, testResults, spans, apiKeys, webhooks (migration 0039) |
| Nonce-based CSP | **Stable** | v1.7 | middleware + layout.tsx |

---

## Deprecation Log

| Item | Deprecated | Removal Target | Migration |
|------|-----------|----------------|-----------|
| `evaluationTestCases` table | v1.2 | v2.0 | Use `testCases` table |
| `requireAuthWithOrg` (direct use in routes) | v1.2 | v2.0 | Wrap with `secureRoute()` |
| `role: string` in AuthContext | v1.2 | v2.0 | Use `role: Role` (typed enum) |
| String timestamps (hot-path tables) | v1.7 | v2.0 | Now integer timestamps via migration 0039 |
| `hasConsistency` returning `{ consistent }` | v2.3 | v3.0 ✅ removed | Use `{ passed }` instead |
| `respondedWithinDuration` returning `boolean` | v2.3 | v3.0 ✅ removed | Now returns `AssertionResult` |
