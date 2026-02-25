# Code Generation Evaluation Example

Regression gate for an LLM-powered code generation system.

## What This Tests

| Metric | How | Gating? |
|--------|-----|---------|
| Syntax validity | Parse generated code with `Function()` | Yes |
| Correctness | Run generated code against test assertions | Yes |
| Style compliance | Check for common anti-patterns | Informational |
| Consistency | Run N times, measure variance | Informational |

## Setup

```bash
cd examples/codegen-eval
npm install
```

No API key needed — uses a simulated code generator for demo purposes.
Replace `simulateCodegen()` with your actual LLM call.

## Run

```bash
npm run eval       # run the eval (exit 0 = pass, exit 1 = fail)
npm run gate       # run with regression gate
```

## Golden Cases

Each case specifies an intent, expected function signature, and test assertions:

```json
{
  "intent": "Write a function that reverses a string",
  "expectedSignature": "reverseString(s)",
  "assertions": [
    { "input": ["hello"], "expected": "olleh" },
    { "input": [""], "expected": "" },
    { "input": ["a"], "expected": "a" }
  ]
}
```

## Scoring

- **Syntax valid** (30%) — Does it parse without errors?
- **Tests pass** (50%) — How many assertions pass?
- **No anti-patterns** (20%) — Avoids `eval()`, `var`, etc.

## Exit Code Contract

| Code | Meaning |
|------|---------|
| 0 | All cases passed (composite score ≥ 70 each) |
| 1 | At least one case failed |

## CI Integration

```yaml
- name: Codegen regression gate
  run: cd examples/codegen-eval && npm ci && npm run eval
```
