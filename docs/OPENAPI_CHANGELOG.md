# OpenAPI Spec Changelog

When you change `docs/openapi.json`, add an entry here before running `pnpm openapi:snapshot`. CI requires this for spec hash changes.

Format: `## X.Y.Z` or `## [X.Y.Z]` with a short description.

## 2.0.0

- Align with SDK 2.0.0 (EvalGate rebrand)

## 1.9.1

- Align OpenAPI spec version with SDK 1.9.1 (security, type fixes, PostgreSQL migration)

## 1.0.1

- Add `evaluationRunId` query parameter to `/api/llm-judge/alignment` endpoint

## 1.0.0

- Initial documented API surface (paths, schemas)
