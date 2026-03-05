## What's New

### 🩺 `evalai doctor --strict` + `--report`
Comprehensive 9-check preflight checklist with pass/fail/warn/skip status, exact remediation commands, JSON diagnostic bundle, and exit codes 0/2/3. `--strict` treats warnings as failures for teams that want enforcement.

### 🔍 `evalai explain` (offline) + `.evalai/last-report.json`
Offline report explainer that reads the auto-saved report artifact with zero flags. Shows top failing test cases, baseline vs current changes, root cause classification (prompt drift, retrieval drift, safety regression, etc.), and prioritized suggested fixes. `evalai check` now automatically writes `.evalai/last-report.json` and prints `Next: evalai explain` on failure.

### 🖨️ `evalai print-config` + CI artifacts doc + AI assistant workflow doc
- **print-config**: Shows resolved config with source-of-truth annotations (`[file]`, `[env]`, `[default]`, `[profile]`, `[arg]`) and redacted secrets
- **CI template**: Doctor preflight step + dual artifact upload (regression-report + last-report)
- **Report schema versioning**: `schemaVersion: 1` on every report; `explain` validates compatibility
- **docs/CI_ARTIFACTS.md**: How to download + explain CI failures locally
- **docs/AI_ASSISTANT_INTEGRATION.md**: Paste-and-debug workflow for Claude/ChatGPT/Copilot
- **examples/minimal-green/**: Zero-dep example that passes on first run

### Guided failure flow
```
evalai check  →  fails  →  "Next: evalai explain"
                               ↓
                    evalai explain  →  root causes + fixes
```

**Full changelog:** https://github.com/evalgate/ai-evaluation-platform/blob/main/src/packages/sdk/CHANGELOG.md
