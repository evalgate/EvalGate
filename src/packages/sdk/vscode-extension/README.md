# EvalGate VS Code Extension — **Scaffold**

> **Status: Skeleton / Not Shippable**
>
> This directory contains the source code and manifest for a VS Code extension
> that would provide inline spec pass/fail gutter icons. It is a **scaffold**,
> not a working extension. It will not appear in the VS Code Marketplace, cannot
> be installed from a `.vsix`, and has no build/test/publish pipeline.

## What Exists

- `package.json` — Extension manifest with activation events, commands, settings
- `src/extension.ts` — Source implementing gutter decorations, diagnostics, status bar, file watcher, 4 commands
- `tsconfig.json` — TypeScript config targeting the VS Code extension host

## What's Missing to Ship

| Item | Status | Notes |
|------|--------|-------|
| SVG icons (`icons/pass.svg`, `icons/fail.svg`, `icons/skip.svg`) | ❌ Missing | Gutter icons referenced in code but not created |
| `.vscodeignore` | ❌ Missing | Needed to exclude source files from packaged `.vsix` |
| `esbuild` or `webpack` bundler config | ❌ Missing | VS Code extensions should be bundled for startup perf |
| Unit tests | ❌ Missing | No `@vscode/test-electron` or `@vscode/test-web` setup |
| CI pipeline (`vsce package` / `vsce publish`) | ❌ Missing | No GitHub Action or script to build and publish |
| Publisher account | ❌ Missing | Requires a verified publisher on the VS Code Marketplace |
| `CHANGELOG.md` | ❌ Missing | Required by marketplace listing |
| `LICENSE` in extension root | ❌ Missing | Marketplace expects it at extension root |
| End-to-end validation | ❌ Missing | Never tested in Extension Development Host |

## Intended Features (When Complete)

- **Gutter Icons**: Pass/fail/skip icons next to each `defineEval()` call
- **Inline Annotations**: Error messages and scores shown inline
- **Status Bar**: Quick summary of last run results
- **Auto-Refresh**: Updates automatically when `.evalgate/last-run.json` changes
- **Commands**: Run all specs, run file specs, discover, and show results

## Commands (Defined but Untested)

| Command | Description |
|---------|-------------|
| `EvalGate: Run All Specs` | Run all evaluation specs |
| `EvalGate: Run Specs in Current File` | Run specs in the active file |
| `EvalGate: Discover Specs` | Discover and build manifest |
| `EvalGate: Show Last Run Results` | Show results in output panel |

## Settings (Defined but Untested)

| Setting | Default | Description |
|---------|---------|-------------|
| `evalgate.autoRun` | `false` | Auto-run specs on file save |
| `evalgate.showGutterIcons` | `true` | Show pass/fail gutter icons |
| `evalgate.showInlineAnnotations` | `true` | Show inline diagnostics |

## How to Finish This

```bash
# 1. Install deps
cd vscode-extension
npm install

# 2. Create icons
mkdir icons
# Add pass.svg, fail.svg, skip.svg (16x16 recommended)

# 3. Compile
npm run compile

# 4. Test in Extension Development Host
# Open this folder in VS Code, press F5

# 5. Package
npx @vscode/vsce package
# Produces evalgate-vscode-0.1.0.vsix

# 6. Publish (requires marketplace publisher account)
npx @vscode/vsce publish
```
