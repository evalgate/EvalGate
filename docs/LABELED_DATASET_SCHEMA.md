---
title: Canonical Labeled Golden Dataset Schema
---

# Canonical labeled dataset schema (for `evalgate label` and `evalgate analyze`)

Canonical path (default):

- `.evalgate/golden/labeled.jsonl`

Format:

- UTF-8 JSONL (one JSON object per line)
- No array wrapper
- Blank lines allowed (ignored)

Required fields per row:

1. `caseId` (string, non-empty)
2. `input` (string)
3. `expected` (string)
4. `actual` (string)
5. `label` (`"pass" | "fail"`)
6. `failureMode` (`string | null`)
   - Must be non-empty string when `label = "fail"`
   - Must be `null` or empty string when `label = "pass"`
7. `labeledAt` (ISO timestamp string)

Example row:

```json
{"caseId":"case-001","input":"What is 2+2?","expected":"4","actual":"5","label":"fail","failureMode":"math_incorrect","labeledAt":"2026-03-08T10:00:00.000Z"}
```

Notes:

- `evalgate analyze` consumes this schema directly.
- `evalgate label` should write rows in this exact shape to avoid migration/refactor churn.
