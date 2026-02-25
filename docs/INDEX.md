# Documentation Index

Canonical paths for all project documentation. If you're linking to a doc, use these paths.

## Getting Started

| Doc | Path | Audience |
|-----|------|----------|
| **Quickstart** | [`docs/quickstart.md`](quickstart.md) | New users |
| **Contributing** | [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Contributors |
| **Contributor Map** | [`docs/CONTRIBUTOR_MAP.md`](CONTRIBUTOR_MAP.md) | Contributors |
| **Architecture** | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Contributors + evaluators |

## Regression Gate

| Doc | Path | Audience |
|-----|------|----------|
| **Regression Gate** | [`docs/REGRESSION_GATE.md`](REGRESSION_GATE.md) | SDK users + CI |
| **GitHub Actions** | [`docs/ci/github-actions.md`](ci/github-actions.md) | CI/CD engineers |

## API & SDK

| Doc | Path | Audience |
|-----|------|----------|
| **API Contract** | [`docs/api-contract.md`](api-contract.md) | API consumers |
| **API Versioning** | [`docs/API_VERSIONING.md`](API_VERSIONING.md) | API consumers |
| **OpenAPI Spec** | [`docs/openapi.json`](openapi.json) | API consumers |
| **OpenAPI Changelog** | [`docs/OPENAPI_CHANGELOG.md`](OPENAPI_CHANGELOG.md) | API consumers |
| **Integration Reference** | [`docs/INTEGRATION_REFERENCE.md`](INTEGRATION_REFERENCE.md) | SDK users |
| **SDK README** | [`src/packages/sdk/README.md`](../src/packages/sdk/README.md) | SDK users |
| **SDK Changelog** | [`src/packages/sdk/CHANGELOG.md`](../src/packages/sdk/CHANGELOG.md) | SDK users |

## Platform Features

| Doc | Path | Audience |
|-----|------|----------|
| **Exporting & Sharing** | [`docs/EXPORTING_AND_SHARING.md`](EXPORTING_AND_SHARING.md) | Platform users |
| **Share Links** | [`docs/share-links.md`](share-links.md) | Platform users |
| **Share Security** | [`docs/SHARE_SECURITY.md`](SHARE_SECURITY.md) | Security reviewers |
| **Demo Assets** | [`docs/demo.md`](demo.md) | Demo setup |
| **MCP Integration** | [`docs/mcp.md`](mcp.md) | MCP users |

## Operations & Governance

| Doc | Path | Audience |
|-----|------|----------|
| **Agent Governance** | [`docs/AGENT_GOVERNANCE.md`](AGENT_GOVERNANCE.md) | Operators |
| **Data Retention** | [`docs/data-retention.md`](data-retention.md) | Compliance |
| **Audit Trail** | [`docs/audit-trail.md`](audit-trail.md) | Compliance |
| **Observability** | [`docs/observability.md`](observability.md) | SREs |
| **SLOs** | [`docs/slos.md`](slos.md) | SREs |
| **Rate Limiting** | [`docs/RATE_LIMITING.md`](RATE_LIMITING.md) | API consumers |
| **Timestamp Policy** | [`docs/TIMESTAMP_POLICY.md`](TIMESTAMP_POLICY.md) | Contributors |

## Testing & Quality

| Doc | Path | Audience |
|-----|------|----------|
| **Test Result Semantics** | [`docs/TEST_RESULT_SEMANTICS.md`](TEST_RESULT_SEMANTICS.md) | Contributors |
| **Stability** | [`docs/stability.md`](stability.md) | Contributors |
| **Adoption Benchmark** | [`docs/adoption-benchmark.md`](adoption-benchmark.md) | Evaluators |

## Infrastructure

| Doc | Path | Audience |
|-----|------|----------|
| **Migration Safety** | [`docs/migration-safety.md`](migration-safety.md) | Contributors |
| **Jobs** | [`docs/jobs.md`](jobs.md) | Contributors |
| **Webhook Executor** | [`docs/webhook-executor-verification.md`](webhook-executor-verification.md) | Integrators |

## Release & Security

| Doc | Path | Audience |
|-----|------|----------|
| **Releasing** | [`docs/RELEASING.md`](RELEASING.md) | Maintainers |
| **Security Policy** | [`SECURITY.md`](../SECURITY.md) | Security researchers |

## Examples

| Example | Path | What it shows |
|---------|------|---------------|
| **RAG Eval** | [`examples/rag-eval/`](../examples/rag-eval/) | RAG regression with retrieval + generation scoring |
| **Codegen Eval** | [`examples/codegen-eval/`](../examples/codegen-eval/) | Code generation eval with syntax + correctness |
| **Agent Tool-Use** | [`examples/agent-tool-use/`](../examples/agent-tool-use/) | Agent workflow gate with tool selection |
| **Quickstart CI** | [`examples/quickstart-ci/`](../examples/quickstart-ci/) | Minimal GitHub Actions gate |
| **Node SDK** | [`examples/node/`](../examples/node/) | Node.js SDK usage |
| **Python** | [`examples/python/`](../examples/python/) | Python usage |

## Link Stability Rules

1. **Never rename a doc** without updating all inbound links first
   - Run: `grep -rn 'OLD_NAME.md' README.md CONTRIBUTING.md docs/ examples/ --include='*.md'`
   - Update every hit before merging
   - If the old path was linked externally (npm README, blog posts), add a redirect note at the top of the new file:
     ```
     > **Moved from `docs/OLD_NAME.md`.** Update your bookmarks.
     ```
2. **New docs** must be added to this index before merging
3. **Cross-references** within `docs/` use relative paths: `[Quickstart](quickstart.md)`
4. **README/CONTRIBUTING links** use `docs/` prefix: `[Quickstart](docs/quickstart.md)`
5. **SDK README links** use relative paths from `src/packages/sdk/`: `[CHANGELOG](CHANGELOG.md)`
6. **Run link audit before any docs PR**:
   ```bash
   # Find all markdown links and check for broken targets
   grep -rn '\[.*\](.*\.md)' README.md CONTRIBUTING.md docs/ --include='*.md' | grep -v node_modules
   ```
7. **Canonical entrypoints** (do not rename these without a redirect):
   - `README.md` → project overview
   - `CONTRIBUTING.md` → contributor onboarding
   - `docs/INDEX.md` → this file (all docs hub)
   - `src/packages/sdk/README.md` → npm package page
