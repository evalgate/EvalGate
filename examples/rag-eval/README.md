# RAG Evaluation Example

End-to-end regression gate for a retrieval-augmented generation pipeline.

## What This Tests

| Metric | How | Gating? |
|--------|-----|---------|
| Answer relevance | LLM judge scores answer vs query | Yes |
| Citation accuracy | Check cited doc IDs match retrieved docs | Yes |
| Hallucination rate | LLM judge flags unsupported claims | Yes |
| Retrieval recall | Compare retrieved chunks vs known-good set | Informational |

## Setup

```bash
cd examples/rag-eval
npm install
```

No API key needed — uses a simulated RAG pipeline for demo purposes.
Replace `simulateRAGPipeline()` with your actual pipeline call.

## Run

```bash
npm run eval       # run the eval (exit 0 = pass, exit 1 = fail)
npm run gate       # run with regression gate
```

## Project Structure

```
rag-eval/
├── rag-eval.ts          # Main eval script
├── golden-cases.json    # Known-good Q&A pairs with expected citations
├── evalai.config.json   # Gate config
├── evals/
│   └── baseline.json    # Committed baseline
└── package.json
```

## Golden Cases

Each case has a query, expected answer pattern, and expected citation doc IDs:

```json
[
  {
    "query": "What is your refund policy?",
    "expectedCitations": ["policy-doc-001"],
    "expectedPattern": "30 days",
    "category": "policy"
  },
  {
    "query": "How do I reset my password?",
    "expectedCitations": ["support-doc-042"],
    "expectedPattern": "settings.*password",
    "category": "support"
  },
  {
    "query": "What are your business hours?",
    "expectedCitations": ["hours-doc-007"],
    "expectedPattern": "9.*5|business hours",
    "category": "info"
  }
]
```

## CI Integration

```yaml
- name: RAG regression gate
  run: npx evalgate gate --format github
```

## Scoring

The eval computes a composite score:
- **Answer relevance** (40%) — Does the answer address the query?
- **Citation accuracy** (30%) — Are the right docs cited?
- **Hallucination rate** (30%) — Are all claims supported by retrieved docs?

Baseline threshold: score must not drop more than 5 points from `evals/baseline.json`.

## Exit Code Contract

| Code | Meaning |
|------|---------|
| 0 | All cases passed (composite score ≥ 70 each) |
| 1 | At least one case failed |

This makes the eval script usable as a CI step directly:

```yaml
- run: cd examples/rag-eval && npm ci && npm run eval
```
