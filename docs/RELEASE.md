# Release & Deprecation

## Publishing @evalgate/sdk (v2.0.0+)

1. Tag: `git tag sdk/v2.0.0 && git push origin sdk/v2.0.0`
2. GitHub Release is created automatically; npm/PyPI publish if tokens are configured.
3. **After publishing the new package**, add a deprecation notice to the old package:

```bash
npm deprecate @pauly4010/evalai-sdk "This package has been renamed to @evalgate/sdk. Install with: npm install @evalgate/sdk"
```

This shows a warning when users install the old package and points them to the new one.

## Python SDK

- Package: `pauly4010-evalgate-sdk` on PyPI
- If you previously published `pauly4010-evalai-sdk`, add a deprecation notice via PyPI project settings or a final release README.
