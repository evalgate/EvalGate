# EvalAI Public API Contract

> **Stability commitment:** Fields documented here are stable. Breaking changes will be versioned and announced.
>
> **OpenAPI:** See `docs/openapi.json` for machine-readable schema. Use for client generation and validation.

---

## 1. Standard Error Envelope

All API errors return this JSON shape:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized",
    "details": null,
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | string | One of: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `QUOTA_EXCEEDED`, `NO_ORG_MEMBERSHIP` |
| `error.message` | string | Human-readable message |
| `error.details` | unknown | Optional; validation errors include Zod `issues` array |
| `error.requestId` | string | UUID for tracing; also in `x-request-id` response header |

**HTTP status mapping:**

| Code | Status |
|------|--------|
| UNAUTHORIZED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| VALIDATION_ERROR | 400 |
| RATE_LIMITED | 429 |
| CONFLICT | 409 |
| INTERNAL_ERROR | 500 |
| SERVICE_UNAVAILABLE | 503 |
| QUOTA_EXCEEDED | 403 |
| NO_ORG_MEMBERSHIP | 403 |

---

## 2. MCP Response Shape

### GET /api/mcp/tools (anonymous)

```json
{
  "mcpVersion": "1",
  "tools": [
    {
      "name": "string",
      "description": "string",
      "inputSchema": { "type": "object", "properties": { ... } },
      "version": "string (optional)",
      "longRunning": "boolean (optional)"
    }
  ]
}
```

### POST /api/mcp/call (authenticated)

**Success (200):**

```json
{
  "ok": true,
  "content": [
    { "type": "json", "json": { /* tool-specific result */ } },
    { "type": "text", "text": "..." }
  ]
}
```

**Error (4xx/5xx):**

```json
{
  "ok": false,
  "error": {
    "code": "string",
    "message": "string",
    "requestId": "uuid"
  }
}
```

---

## 3. Quality Score Response Shape

### GET /api/quality?evaluationId=&action=latest

**When score exists (200):**

```json
{
  "id": 1,
  "evaluationRunId": 1,
  "evaluationId": 1,
  "organizationId": 1,
  "score": 85,
  "total": 10,
  "traceCoverageRate": "1.0",
  "provenanceCoverageRate": "0.9",
  "breakdown": {},
  "flags": [],
  "evidenceLevel": "strong",
  "scoringVersion": "v1",
  "model": null,
  "createdAt": "2024-01-15T12:00:00.000Z",
  "baselineScore": 80,
  "regressionDelta": 5,
  "regressionDetected": false,
  "baselineMissing": false
}
```

**When no scores yet (200):**

```json
{
  "score": null,
  "message": "No quality scores computed yet"
}
```

### POST /api/quality (recompute)

```json
{
  "success": true,
  "runId": 1,
  "score": 92,
  "breakdown": {},
  "flags": [],
  "evidenceLevel": "strong",
  "scoringVersion": "v1",
  "scoringSpecHash": "sha256-hex"
}
```

---

## 3b. Runs Import

### POST /api/evaluations/[id]/runs/import

Import local run results for an existing evaluation. Creates run, inserts test_results, computes quality.

**Headers:** `Idempotency-Key` (optional) — prevents duplicate runs on CI retry. Same key returns existing run (200).

**Request body:**

```json
{
  "environment": "dev",
  "importClientVersion": "1.5.0",
  "results": [
    { "testCaseId": 1, "status": "passed", "output": "...", "latencyMs": 100 }
  ]
}
```

**Policy: All-or-nothing.** If any `testCaseId` is invalid or not in the evaluation, the whole request is rejected. No partial imports.

**Response (201 or 200 on idempotent replay):**

```json
{
  "runId": 1,
  "score": 85,
  "flags": [],
  "dashboardUrl": "https://.../evaluations/42/runs/1"
}
```

**Run metadata:** Imported runs store `traceLog.import = { source: "import", importedAt, clientReportedVersion }` for audit.

---

## 4. Report Payload Schema

### POST /api/reports (create report)

**Request:** `{ evaluationId, evaluationRunId, expiresInDays?, policyName? }`

**Response (201):**

```json
{
  "shareToken": "hex",
  "shareUrl": "https://.../r/{shareToken}",
  "apiUrl": "https://.../api/r/{shareToken}",
  "expiresAt": "2024-02-15T00:00:00.000Z"
}
```

**Signed report body (stored, returned via GET /api/r/[shareToken]):**

```json
{
  "signatureAlgorithm": "hmac-sha256-v1",
  "version": "2.0",
  "generatedAt": "ISO8601",
  "organization": { "id": 1, "name": "string" },
  "evaluation": {
    "id": 1,
    "name": "string",
    "type": "string",
    "status": "string",
    "publishedVersion": 1,
    "snapshotHash": "sha256-hex"
  },
  "run": {
    "id": 1,
    "status": "string",
    "totalCases": 10,
    "passedCases": 8,
    "failedCases": 2,
    "startedAt": "ISO8601",
    "completedAt": "ISO8601"
  },
  "qualityScore": {
    "score": 85,
    "breakdown": {},
    "flags": [],
    "scoringVersion": "v1",
    "scoringSpecHash": "string",
    "scoringCommit": "string",
    "inputsHash": "string",
    "provenanceCoverageRate": "0.9"
  } | null,
  "testResultsSummary": { "total": 10, "passed": 8, "failed": 2 },
  "drift": { "alertType", "severity", "explanation", "detectedAt", "acknowledged" } | null,
  "policyResult": { "policy", "compliant" } | null,
  "baseline": { "baselineScore", "regressionDelta", "regressionDetected" } | null
}
```

---

## 5. Export Payload Schema

### GET /api/evaluations/[id]/runs/[runId]/export

Returns type-specific export. Base shape:

```json
{
  "evaluation": {
    "id": "string",
    "name": "string",
    "description": "string",
    "type": "unit_test | human_eval | model_eval | ab_test",
    "category": "string",
    "created_at": "ISO8601"
  },
  "timestamp": "ISO8601",
  "summary": {
    "totalTests": 10,
    "passed": 8,
    "failed": 2,
    "passRate": "80%"
  },
  "qualityScore": { /* AI quality score object */ }
}
```

**human_eval additions:**

```json
{
  "type": "human_eval",
  "evaluations": [
    {
      "id": "string",
      "evaluator_id": "string",
      "evaluator_name": "string",
      "test_case_id": "string",
      "ratings": {},
      "comments": "string",
      "timestamp": "ISO8601"
    }
  ],
  "interRaterReliability": {
    "cohens_kappa": 0.85,
    "fleiss_kappa": 0.82,
    "agreement_percentage": 0.9
  },
  "criteria": [{ "name", "description", "scale", "average_score" }]
}
```

**unit_test additions:** `testResults[]` with `id`, `name`, `input`, `expected_output`, `actual_output`, `passed`, `execution_time_ms`, `error_message`

**model_eval additions:** `judgeEvaluations[]`, `judgePrompt`, `judgeModel`, `aggregateMetrics`

---

## Versioning

- **Error envelope:** Stable since v1.
- **Report payload:** `version: "2.0"`; `signatureAlgorithm: "hmac-sha256-v1"`.
- **Quality:** `scoringVersion: "v1"`; `scoringSpecHash` for audit.
