# OTEL Integration Test

End-to-end verification that `OTelExporter.exportRunResult()` produces valid
OTLP JSON that a real OpenTelemetry Collector ingests and forwards to Jaeger.

This is the **real feature test** — the unit tests in `__tests__/otel.test.ts`
verify JSON shape; this test proves the payload actually lands in a trace backend.

## Prerequisites

- Docker + Docker Compose

## Run (one command)

```bash
# From the SDK root:
pnpm otel:test

# Or manually:
cd src/packages/sdk/otel-integration
./run-test.sh

# Leave containers running for manual inspection:
./run-test.sh --no-down
# Then visit Jaeger UI: http://localhost:16686
```

The script handles the full lifecycle:
1. Checks Docker is installed and running
2. `docker compose up -d --wait`
3. Waits for the collector health endpoint
4. Runs `verify-otel.ts` (push trace → query Jaeger)
5. `docker compose down` (unless `--no-down`)

## What It Validates

1. **OTLP POST accepted** — Collector returns HTTP 200 for our payload
2. **Service registered** — Jaeger shows `evalgate-integration-test` in its service list
3. **Trace ingested** — The specific trace ID is queryable in Jaeger
4. **Span count matches** — All spans (root + per-spec children) appear in the backend

## Architecture

```
verify-otel.ts  →  OTLP HTTP POST  →  otel-collector:4318  →  jaeger:4317
                                          (health: :13133)       (UI: :16686)
```
