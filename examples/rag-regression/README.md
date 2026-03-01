# RAG Regression Evaluation

Evaluates retrieval-augmented generation (RAG) systems for drift and quality.

## Use Case

- **Context:** RAG pipeline (retriever + generator)
- **Goal:** Catch regressions when docs or prompts change
- **Metrics:** Answer relevance, citation accuracy, hallucination rate

## Eval Cases

| Input (Query) | Expected Behavior |
|---------------|-------------------|
| "What is our refund policy?" | Cites policy doc, no hallucination |
| "How do I reset my password?" | Cites support doc, actionable steps |
| "What are your hours?" | Cites hours, no made-up times |

## Baseline

- **Baseline score:** 85/100 (configurable in `evalai.config.json`)
- **Regression threshold:** Fail if score drops >5 points

## GitHub Actions

```yaml
- name: RAG regression gate
  env:
    EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  run: npx -y @evalgate/sdk@^1 check --format github --onFail import
```

## Screenshot

![Pass/fail annotations on PR](https://via.placeholder.com/600x200?text=CI+annotations+visible+on+PR)

Replace with actual screenshot of `evalai check` passing/failing in CI.
