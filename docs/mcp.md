# MCP-Compatible Tool Discovery & Execution

EvalGate exposes an **MCP-style tool discovery and execution API** for AI agents (Cursor, Claude, ChatGPT, etc.). Tools map to platform services: evaluations, quality scores, traces, spans, and test cases.

## Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/mcp/tools` | None (public) | List available tools and input schemas |
| POST | `/api/mcp/call` | Required | Execute a tool |

## Authentication

Use either:

- **Session cookie** — when using the platform in a browser
- **API key** — `Authorization: Bearer <EVALAI_API_KEY>`

Get API keys from **Settings → Developer** in the app.

## Tool Discovery

```bash
curl -X GET "https://evalgate.com/api/mcp/tools"
```

**Response:**

```json
{
  "tools": [
    {
      "name": "eval.quality.latest",
      "description": "Get the latest quality score for an evaluation.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "evaluationId": { "type": "number", "description": "ID of the evaluation" },
          "baseline": { "type": "string", "enum": ["published", "previous", "production"] }
        },
        "required": ["evaluationId"]
      }
    }
  ]
}
```

## Tool Execution

```bash
curl -X POST "https://evalgate.com/api/mcp/call" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "tool": "eval.quality.latest",
    "arguments": { "evaluationId": 42, "baseline": "published" }
  }'
```

**Success (200):**

```json
{
  "ok": true,
  "content": [{ "type": "text", "text": "{\"score\":85,\"baselineScore\":82,...}" }]
}
```

**Error (400):**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Evaluation not found",
    "requestId": "uuid"
  }
}
```

Validation errors (invalid body, unknown tool, missing auth) use the same `error` envelope with appropriate `code` and `message`.

## Available Tools

| Tool | Description | Required scope |
|------|-------------|----------------|
| `eval.quality.latest` | Latest quality score for an evaluation | `runs:read` |
| `eval.list` | List evaluations | `eval:read` |
| `eval.get` | Get evaluation details | `eval:read` |
| `eval.run` | Run an evaluation | `runs:write` |
| `eval.testcase.add` | Add a test case | `eval:write` |
| `trace.create` | Create a trace | `traces:write` |
| `trace.span.create` | Create a span | `traces:write` |

Scopes are enforced per tool. API keys are created with specific scopes in **Settings → Developer**.

## Error Envelopes

All errors return a stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "requestId": "uuid",
    "details": {}
  }
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`.

## Rate Limits

MCP tool execution uses a dedicated rate limit tier (`mcp`): **100 requests per minute** per identifier (IP or API key). This is separate from REST API limits.

## Tool Versioning

Tools include an optional `version` field in discovery. Use this for future migrations when tool behavior changes.

## Long-Running Tools

Some tools (e.g. `eval.run`) are marked `longRunning: true` in discovery. Currently they execute synchronously. Future implementations may return `202 Accepted` with a job ID and polling URL for async execution.

## Usage Tracking

Tool executions are logged to `api_usage_logs` with `endpoint: "mcp:<toolName>"`. API key usage is visible in **Settings → Developer → API Keys → Usage**.

## See also

- [Webhook Executor Verification](webhook-executor-verification.md) — HMAC verification and replay protection for webhook executor receivers
