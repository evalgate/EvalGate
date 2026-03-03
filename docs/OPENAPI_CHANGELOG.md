# OpenAPI Spec Changelog

When you change `docs/openapi.json`, add an entry here before running `pnpm openapi:snapshot`. CI requires this for spec hash changes.

Format: `## X.Y.Z` or `## [X.Y.Z]` with a short description.

## 2.2.0

- Bump spec version to align with SDK 2.2.0 (bug fixes: specId collision, explain RunResult support, baseline self-contained, impact-analysis clean errors; new APIs: expect().not, hasPII, defineSuite object form; breaking: snapshot param order swap)

## 2.1.3

- Fix critical post-mortem bugs: multi-defineEval discovery, false regression gate, doctor localhost default, simulated execution, scoring opacity, explain "unnamed"

## 2.1.2

- Align spec version with platform 2.1.2 (type safety fixes, CI gate alignment)

## 2.1.0

- Align OpenAPI spec version with SDK 2.1.0 (EvalGate Intelligence Layer — behavioral drift, multi-judge, three-layer scoring, dataset coverage, failure detection)

## 2.0.0

- Align with SDK 2.0.0 (EvalGate rebrand)

## 1.9.1

- Align OpenAPI spec version with SDK 1.9.1 (security, type fixes, PostgreSQL migration)

## 1.0.1

- Add `evaluationRunId` query parameter to `/api/llm-judge/alignment` endpoint

## 1.0.0

- Initial documented API surface (paths, schemas)
