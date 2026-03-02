# SDK Versioning

Versioning and release process for the TypeScript and Python SDKs.

## TypeScript SDK (@evalgate/sdk)

| Package | Registry | Version |
|---------|----------|---------|
| `@evalgate/sdk` | npm | See [package.json](../src/packages/sdk/package.json) |

### Semver Policy

- **Major** — breaking changes to SDK exports, CLI flags, or report schema
- **Minor** — new CLI commands, new exports, new features
- **Patch** — bug fixes, doc-only changes, test additions

### Release Process

1. Bump `version` in `src/packages/sdk/package.json`
2. Add `## [X.Y.Z] - YYYY-MM-DD` section to `src/packages/sdk/CHANGELOG.md`
3. Commit and push to `main`
4. Tag and push: `git tag sdk/vX.Y.Z && git push origin sdk/vX.Y.Z`
5. `release.yml` workflow triggers on `sdk/v*` tags and publishes to npm

See [RELEASING.md](RELEASING.md) for full details.

## Python SDK (pauly4010-evalgate-sdk)

| Package | Registry | Version |
|---------|----------|---------|
| `pauly4010-evalgate-sdk` | PyPI | See [pyproject.toml](../src/packages/sdk-python/pyproject.toml) |

### Semver Policy

Same as TypeScript: major = breaking, minor = features, patch = fixes.

### Release Process

1. Bump `version` in `src/packages/sdk-python/pyproject.toml`
2. Update `src/packages/sdk-python/CHANGELOG.md`
3. Commit and push to `main`
4. Tag and push: `git tag sdk-python/vX.Y.Z && git push origin sdk-python/vX.Y.Z`
5. CI workflow publishes to PyPI (if configured)

## Version Consistency

The SDKs are not required to share the same version number. They are released independently. Feature parity is maintained where possible; see CHANGELOGs for per-SDK changes.
