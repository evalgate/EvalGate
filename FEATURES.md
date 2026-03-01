# Features

**EvalAI is CI for AI behavior.** Block regressions before they reach production — Node, Python, or REST API.

## Status Key

| Badge | Meaning |
|-------|---------|
| Production | Stable, production-ready |
| Beta | Functional, may evolve |
| Planned | On the roadmap |

## Feature Matrix

### Regression Gate
| Feature | Status |
|---------|--------|
| `evalgate init` zero-config scaffolder | Production |
| `evalgate gate` local regression gate | Production |
| `evalgate ci` one-command CI loop | Production |
| GitHub Step Summary integration | Production |
| Baseline governance (CODEOWNERS) | Production |
| Multi-runner detection | Production |

### Evaluation Engine
| Feature | Status |
|---------|--------|
| 4 evaluation types (unit, human, LLM judge, A/B) | Production |
| 50+ evaluation templates | Production |
| Visual evaluation builder | Production |
| Quality score dashboard | Production |
| Evaluation versioning & publishing | Beta |

### Observability
| Feature | Status |
|---------|--------|
| Distributed traces & spans | Production |
| Workflow orchestration tracking | Production |
| Per-call cost tracking | Production |
| Agent handoffs & decisions | Beta |
| Drift detection (z-score) | Beta |

### Developer Experience
| Feature | Status |
|---------|--------|
| TypeScript SDK (`@evalgate/sdk`) | Production (v2.0.0) |
| Python SDK (`pauly4010-evalgate-sdk`) | Production |
| CLI (12 commands) | Production |
| API key auth (scoped, hashed) | Production |
| Programmatic regression gate exports | Production |

### Security & Compliance
| Feature | Status |
|---------|--------|
| Multi-tenant auth & RBAC | Production |
| Audit logging | Production |
| Rate limiting (5 tiers) | Production |
| Governance policy templates | Beta |
| Self-hosted Docker | Beta |

### Planned
| Feature | Timeline |
|---------|----------|
| Advanced product analytics | Q2 2026 |
| Custom LLM judge models | Q2 2026 |
| Team collaboration features | Q3 2026 |

## Use Cases

### 1. Catch LLM Regressions in CI Before They Reach Production

**Problem:** LLMs don't fail like traditional software — they drift silently. Your team ships a prompt change that silently degrades answer quality by 15%. Users notice before you do.

**Solution:** `evalgate init` scaffolds a regression gate in your CI pipeline. Every PR runs your evaluation suite and blocks merges when quality drops below the baseline.

**Example:** See `examples/ci-regression-gate/`

### 2. Monitor Multi-Agent Workflow Costs and Decisions

**Problem:** Your multi-agent system's costs are climbing but you don't know which agent or which decisions are responsible.

**Solution:** Instrument with `WorkflowTracer` to capture every agent handoff, tool call, and LLM invocation with cost tracking. The trace viewer shows the full decision DAG.

**Example:** See `examples/agent-tool-use/`

### 3. Run Human-in-the-Loop Annotation Campaigns

**Problem:** You need domain experts to evaluate LLM outputs for a healthcare application, but lack tooling for structured annotation.

**Solution:** Create annotation tasks with configurable rubrics. Assign to team members with role-based access. Track inter-annotator agreement and aggregate scores.
