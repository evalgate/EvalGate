# Changelog

All notable changes to the EvalGate Python SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbering is aligned with the TypeScript SDK (`@evalgate/sdk`) and the platform API.

**Version history note:** The Python SDK jumped from 1.0.0 → 1.9.x → 2.0.0 to stay in sync with the TypeScript SDK. The TypeScript SDK had many releases (1.1–1.9) before the Python SDK existed. We now align both SDKs on the same major.minor version.

## [2.1.1] - 2026-03-02

### Fixed

- **Contract payload validation** - Fixed ruff errors in test_contract_payloads.py
- **CI integration** - Resolved test suite compatibility issues
- **Linting compliance** - Fixed SIM102, E501, SIM105, I001, SIM300 ruff violations

### Changed

- **Test coverage** - Improved test matrix for TypeScript/Python SDK compatibility
- **Documentation** - Updated README with PyPI downloads badge and GitHub stars

## [2.0.0] - 2026-03-01

### Breaking

- **Rebrand:** Package renamed `pauly4010-evalai-sdk` → `pauly4010-evalgate-sdk`, module `evalai_sdk` → `evalgate_sdk`
- **CLI:** `evalai` → `evalgate`
- **Config:** `.evalai/` → `.evalgate/` (legacy `.evalai/` still read, with deprecation warning)
- **Env vars:** `EVALAI_*` → `EVALGATE_*` (legacy `EVALAI_*` still work, with deprecation warning)
- **Error class:** `EvalAIError` → `EvalGateError`

### Added

- Deprecation warnings when using legacy env vars or config paths

## [1.9.1] - 2026-03-01

### Fixed

- Align `SPEC_VERSION` with OpenAPI spec 1.9.1
- Ruff lint and format fixes (SIM102, E501, SIM105, I001, SIM300)

### Changed

- Package metadata: Production/Stable status, improved description and keywords
- README: Added PyPI downloads badge, GitHub stars, status section, changelog link

## [1.9.0] - 2026-02-27

### Added

- Full parity with TypeScript SDK 1.9.0
- `evalai ci` CLI command — one-command CI loop
- Run artifact retention and diff system
- Impact analysis integration
- Schema versioning for run reports

### Changed

- Exit codes standardized: 0=clean, 1=regressions, 2=config/infra
- CLI output improvements for CI environments

## [1.0.1] - 2026-02-26

### Fixed

- CLI init template and credential resolution
- Run output formatting

## [1.0.0] - 2026-02-25

### Added

- Initial Python SDK release
- `AIEvalClient` — async HTTP client for EvalGate API
- 20+ assertions: `expect()`, `to_contain`, `to_not_contain_pii`, `to_be_professional`, etc.
- Test suites: `create_test_suite`, `TestSuiteConfig`, `TestSuiteCase`
- Integrations: OpenAI, Anthropic, LangChain, CrewAI, AutoGen tracing
- Workflow tracing: `WorkflowTracer`, handoffs, cost tracking
- Regression gates: `evaluate_regression`, `to_pass_gate`
- CLI: `evalai init`, `evalai run`, `evalai gate`, `evalai ci`, `evalai doctor`
- Batch processing, caching, pagination, structured errors
- Full type hints (`py.typed`), mypy and Pyright compatible
