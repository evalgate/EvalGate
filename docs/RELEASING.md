# Releasing @pauly4010/evalai-sdk

How to cut a new release. The CI does the heavy lifting — you just tag and push.

## Prerequisites

- You're on `main` with a clean working tree
- `CHANGELOG.md` has a `## [X.Y.Z]` section for the new version
- `package.json` version matches the tag you're about to create
- All CI checks are green

## Steps

### 1. Bump version + changelog (already done if following dev workflow)

```bash
# In src/packages/sdk/package.json — bump "version"
# In src/packages/sdk/CHANGELOG.md — add ## [X.Y.Z] - YYYY-MM-DD section
```

### 2. Commit

```bash
git add src/packages/sdk/package.json src/packages/sdk/CHANGELOG.md
git commit -m "chore: bump SDK to vX.Y.Z"
git push
```

### 3. Tag and push

```bash
# SDK releases use the sdk/v prefix
git tag sdk/v1.7.0
git push origin sdk/v1.7.0
```

### 4. What happens automatically

The `release.yml` workflow triggers on `sdk/v*` tags and:

1. Installs dependencies + runs tests (reproducible release)
2. Runs OpenAPI audit
3. Builds the SDK (`pnpm sdk:build`)
4. Extracts the changelog snippet for this version
5. Creates a **GitHub Release** with the changelog + install command
6. Publishes to **npm** (if `NPM_TOKEN` secret is set)

### 5. Verify

- Check [GitHub Releases](https://github.com/pauly7610/ai-evaluation-platform/releases) for the new entry
- Check [npm](https://www.npmjs.com/package/@pauly4010/evalai-sdk) for the published version

## Manual npm Publish (if NPM_TOKEN not configured)

```bash
cd src/packages/sdk
pnpm run build
npm publish --access public
```

## Tag Format

| Tag | Triggers | Example |
|-----|----------|---------|
| `sdk/vX.Y.Z` | SDK release | `sdk/v1.7.0` |
| `vX.Y.Z` | Platform release | `v2.0.0` |

## Versioning Policy

- **Major** — breaking changes to SDK exports, CLI flags, or report schema
- **Minor** — new CLI commands, new exports, new features
- **Patch** — bug fixes, doc-only changes, test additions

## Changelog Linkage

Every GitHub Release body includes:
- The changelog snippet extracted from `src/packages/sdk/CHANGELOG.md`
- An install command: `npm install @pauly4010/evalai-sdk@X.Y.Z`
- Auto-generated release notes (commits since last tag)

The `scripts/release-changelog-snippet.ts` script handles extraction. It fails the release if:
- The version header is missing from CHANGELOG.md
- The version header appears more than once
- The changelog section is empty

## What If Publish Fails Halfway?

| Failure | What happened | Recovery |
|---------|--------------|----------|
| **Tests fail in release.yml** | Tag exists, no GitHub Release, no npm publish | Fix the test, delete the tag (`git tag -d sdk/vX.Y.Z && git push --delete origin sdk/vX.Y.Z`), re-tag after fix |
| **GitHub Release created, npm publish failed** | Release visible on GitHub, old version on npm | Run manual publish: `cd src/packages/sdk && pnpm run build && npm publish --access public` |
| **npm publish succeeded, GitHub Release failed** | Package live on npm, no release notes | Create the GitHub Release manually from the [releases page](https://github.com/pauly7610/ai-evaluation-platform/releases/new) using the tag |
| **Published wrong version / broken package** | Bad version live on npm | Yank immediately: `npm unpublish @pauly4010/evalai-sdk@X.Y.Z` (within 72h). Then bump to X.Y.Z+1 as a patch fix and re-release. Never re-use a yanked version number. |

### Key rules

- **Never re-use a version number** — even if you yank it, npm blocks re-publish of the same version
- **Prefer patch bump** over yank when possible — `1.7.1` fix is less disruptive than yanking `1.7.0`
- **`continue-on-error: true`** on the npm step means a publish failure won't break the GitHub Release

## Workflow Verification

The `release.yml` workflow is confirmed to:

1. **Trigger on `sdk/v*` tags** — line 9: `- "sdk/v*"` ✅
2. **Publish only the SDK package** — line 80: `cd src/packages/sdk` before `npm publish` ✅
3. **Require `NPM_TOKEN` secret** — line 76: `if: env.NPM_TOKEN != ''` (skips if not set) ✅
4. **Use `--access public`** — line 82: scoped package needs this flag ✅

If you change the tag format, update both `release.yml` triggers and this doc.

## Checklist

```
[ ] package.json version bumped
[ ] CHANGELOG.md has ## [X.Y.Z] section
[ ] All CI checks green on main
[ ] git tag sdk/vX.Y.Z && git push origin sdk/vX.Y.Z
[ ] GitHub Release created (automatic)
[ ] npm version updated (automatic or manual)
[ ] Verify: npm view @pauly4010/evalai-sdk version
```
