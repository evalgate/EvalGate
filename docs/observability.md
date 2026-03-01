# Observability

## Log Schema

Structured logs from API routes follow this shape.

### Request lifecycle

| Field | Type | When |
|-------|------|------|
| `requestId` | string | Every request (start + completed) |
| `route` | string | Path (e.g. `/api/exports/abc123`) |
| `method` | string | HTTP method |
| `durationMs` | number | On completion |
| `statusCode` | number | On completion |

### Error responses

| Field | Type | When |
|-------|------|------|
| `code` | string | Error code (e.g. `RATE_LIMITED`, `NOT_FOUND`) |
| `message` | string | Human-readable message |
| `requestId` | string | Correlation ID |
| `status` | number | HTTP status |

### Share endpoints

When the route includes a share ID (e.g. `/api/exports/[shareId]`), `shareId` may be included in logs for debugging.

### Client identification

Request headers `X-EvalGate-SDK-Version` and `X-EvalGate-Spec-Version` identify the client. These can be logged for compatibility debugging.

## Correlation

Use `x-request-id` response header or `requestId` in error JSON to correlate logs across services.
