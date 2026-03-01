# OpenAPI Spec Changelog

When you change `docs/openapi.json`, add an entry here before running `pnpm openapi:snapshot`. CI requires this for spec hash changes.

Format: `## X.Y.Z` or `## [X.Y.Z]` with a short description.

## 1.0.1

- Add `evaluationRunId` query parameter to `/api/llm-judge/alignment` endpoint

## 1.0.0

- Initial documented API surface (paths, schemas)
