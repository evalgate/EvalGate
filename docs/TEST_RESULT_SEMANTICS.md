# TestResult Semantics (Canonical Contract)

This document defines the canonical semantics for evaluation test results across all evaluators (unit test, model eval, shadow eval, trace-linked, etc.). Every producer of `test_results` must conform to this contract.

## Status Values

| Status | Meaning |
|--------|---------|
| `passed` | All primary assertions passed. The test case met the evaluation criteria. |
| `failed` | One or more primary assertions failed. The output did not meet the evaluation criteria. |
| `error` | Execution or infrastructure failure (e.g., executor timeout, LLM error, network failure). |

**Note:** `skipped` is deprecated for new code. Use `passed` with `assertionsJson` indicating skip reason if needed.

## assertionsJson (Optional)

`assertionsJson` may exist **even when `status=passed`**. This supports:

- **Passed functional, failed safety**: Output passed correctness checks but failed a safety assertion (e.g., PII detected, toxicity). Store both in `assertionsJson`; `status` reflects the primary gate (functional pass/fail).
- **Partial results**: Some assertion categories (e.g., `pii`, `toxicity`, `json_schema`) can be computed independently. All results are stored for audit and compliance.

### Envelope Shape

```json
{
  "pii": false,
  "toxicity": false,
  "json_schema": true,
  "functional": true
}
```

- **Known keys**: `pii`, `toxicity`, `json_schema`, `functional`, `safety`, `judge`. Unknown keys must be rejected or stored in `meta` only—they do not count toward safety/compliance.
- **Write boundary**: All producers must use the shared transformer/validator before writing. Reject unknown assertion keys at the write boundary.

## Consistency Rules

1. **Every evaluator** produces `status` + optional `assertionsJson` consistently.
2. **`status=passed`** means the primary evaluation gate passed. It does NOT imply all safety assertions passed—check `assertionsJson` for that.
3. **`status=failed`** means the primary gate failed. `assertionsJson` may provide breakdown.
4. **`status=error`** means execution failed before assertions could run. `error` field should be populated.

## Producers

| Producer | Location | Notes |
|----------|----------|-------|
| EvaluationService.run | `src/lib/services/evaluation.service.ts` | Unit test, model eval, A/B test |
| ShadowEvalService | `src/lib/services/shadow-eval.service.ts` | Shadow evals |
| EvalWorker | `src/lib/workers/eval-worker.ts` | Async worker path |
| Trace-linked executor | `src/lib/services/eval-executor.ts` | Trace-linked runs |

All must use `runAssertions()` (when enabled) and the shared assertion envelope before inserting into `test_results`.
