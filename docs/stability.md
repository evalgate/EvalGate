# Stability Matrix

> Last updated: 2026-02-18

This document classifies every major feature by maturity level and provides API compatibility guarantees for each tier.

## Maturity Tiers

| Tier | Meaning | API Compatibility Promise |
|------|---------|--------------------------|
| **Stable** | Production-ready, tested, unlikely to change shape | Breaking changes only in major versions. Minimum 90 days deprecation notice. |
| **Beta** | Functional and usable, may refine behaviour or payload shape | May change in minor versions. 30 days notice for breaking changes. |
| **Alpha** | Experimental, available for feedback | Can change at any time without notice. |

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
| `evalai check` CLI | **Stable** | v1.1 | `--minScore`, `--maxDrop`, `--format github|json|human`, `--onFail import`, `--explain` |
| `evalai init` CLI | **Stable** | v1.4 | Creates `evalai.config.json` |
| `evalai doctor` CLI | **Stable** | v1.5 | Verify CI setup (config, API key, quality endpoint) |
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

### SDK (`@pauly4010/evalai-sdk`)

| Feature | Tier | Since | Notes |
|---------|------|-------|-------|
| `AIEvalClient` | **Stable** | v1.0 | Core client class |
| `WorkflowTracer` | **Stable** | v1.0 | Trace instrumentation |
| `createTestSuite` + `expect` | **Stable** | v1.0 | Testing DSL |
| Assertions library | **Stable** | v1.0 | 15+ assertion types |
| Framework integrations | **Beta** | v1.0 | Jest, Vitest adapters |

---

## Deprecation Log

| Item | Deprecated | Removal Target | Migration |
|------|-----------|----------------|-----------|
| `evaluationTestCases` table | v1.2 | v2.0 | Use `testCases` table |
| `requireAuthWithOrg` (direct use in routes) | v1.2 | v2.0 | Wrap with `secureRoute()` |
| `role: string` in AuthContext | v1.2 | v2.0 | Use `role: Role` (typed enum) |
