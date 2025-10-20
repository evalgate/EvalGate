# Changelog

All notable changes to the @evalai/sdk package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-10-20

### 🐛 Fixed

#### Additional Browser Compatibility Fixes

- **process.env Access**: Added safe `getEnvVar()` helper function for browser compatibility
  - Client constructor now works in browsers without `process.env`
  - `AIEvalClient.init()` now safe in browsers
  - Falls back gracefully when environment variables are not available
- **Type Name Collision**: Renamed test suite types to avoid confusion
  - `TestCase` → `TestSuiteCase` (for test suite definitions)
  - `TestCaseResult` → `TestSuiteCaseResult`
  - Legacy type aliases provided for backward compatibility
  - API `TestCase` type (from types.ts) remains unchanged

### 📚 Documentation

- Updated `AIEvalClient.init()` JSDoc with browser usage examples
- Added deprecation notices for legacy test suite type names
- Clarified environment variable behavior (Node.js only)

### 🔄 Migration Notes

No breaking changes! Legacy type names are aliased for backward compatibility:

- `TestCase` still works (aliased to `TestSuiteCase`)
- `TestCaseResult` still works (aliased to `TestSuiteCaseResult`)

**Recommended**: Update to new type names to avoid future deprecation:

```typescript
// OLD (still works, but deprecated)
import { TestCase } from "@evalai/sdk";

// NEW (recommended)
import { TestSuiteCase } from "@evalai/sdk";
```

---

## [1.2.1] - 2025-01-20

### 🐛 Fixed

#### Critical Bug Fixes

- **CLI Import Paths**: Fixed imports in CLI to use compiled paths (`../client.js`) instead of source paths (`../src/client`)
- **Duplicate Traces**: Fixed OpenAI and Anthropic integrations creating duplicate trace entries. Now creates a single trace with the final status
- **Commander.js Syntax**: Fixed invalid nested command structure (`eval` -> `run` to `eval:run`)
- **Context System Browser Compatibility**: Replaced Node.js-only `AsyncLocalStorage` with environment-aware implementation
  - Node.js: Uses `AsyncLocalStorage` for true async context propagation
  - Browser: Uses stack-based approach with helpful limitations documented
- **Path Traversal Security**: Added comprehensive security checks to snapshot path sanitization
  - Prevents empty names
  - Prevents path traversal attacks (`../`)
  - Validates paths stay within snapshot directory
  - Sanitizes to alphanumeric, hyphens, and underscores only

#### Developer Experience Improvements

- **Environment Detection**: Added runtime checks for Node.js-only features
  - `snapshot.ts` - Throws helpful error in browsers
  - `local.ts` - Throws helpful error in browsers
  - `context.ts` - Gracefully degrades in browsers
- **Empty Exports Removed**: Removed misleading empty `StreamingClient` and `BatchClient` objects
  - Now exports actual implementations: `batchProcess`, `streamEvaluation`, `batchRead`, `RateLimiter`
- **Error Handling**: Integration wrappers now catch and ignore trace creation errors to avoid masking original errors

### 📦 Changed

#### Dependencies

- **Updated**: `commander` from `^12.0.0` to `^14.0.0`
- **Added**: Peer dependencies (optional)
  - `openai`: `^4.0.0`
  - `@anthropic-ai/sdk`: `^0.20.0`
- **Added**: Node.js engine requirement `>=16.0.0`

#### Package Metadata

- **Version**: Bumped to `1.2.1`
- **Keywords**: Added `openai` and `anthropic`

### 📚 Documentation

#### README Updates

- **Environment Support Section**: New section clarifying Node.js vs Browser features
  - ✅ Works Everywhere: Core APIs, assertions, test suites
  - 🟡 Node.js Only: Snapshots, local storage, CLI, file exports
  - 🔄 Context: Full support in Node.js, basic in browsers
- **Changelog**: Updated with v1.2.1 fixes
- **Installation**: Unchanged
- **Examples**: All existing examples remain valid

#### Code Documentation

- Added JSDoc warnings to Node.js-only modules
- Added inline comments explaining environment checks
- Updated integration examples to reflect single-trace behavior

### 🔒 Security

- **Path Traversal Prevention**: Multiple layers of validation in snapshot system
- **Input Sanitization**: Comprehensive name validation before filesystem operations
- **Directory Boundary Enforcement**: Prevents writing outside designated directories

### ⚡ Performance

- **Reduced API Calls**: Integration wrappers now make 1 trace call instead of 2
- **Faster Errors**: Environment checks happen at module load time

### 🔄 Migration Guide from 1.2.0 to 1.2.1

#### No Breaking Changes! ✅

All fixes are backward compatible. However, you may notice:

1. **Integration Tracing**: You'll see fewer trace entries (1 per call instead of 2)
   - **Before**: `pending` trace → `success` trace (2 entries)
   - **After**: `success` trace (1 entry)

2. **CLI Command**: Use `evalai eval:run` instead of `evalai eval run`
   - Old syntax will fail, update your scripts

3. **Browser Usage**: Node.js-only features now throw helpful errors

   ```javascript
   // In browser:
   import { snapshot } from "@evalai/sdk";
   snapshot("test", "name"); // ❌ Throws: "Snapshot testing requires Node.js..."
   ```

4. **Context in Browsers**: Limited async propagation
   ```javascript
   // Works in both Node.js and browser, but browser has limitations
   await withContext({ userId: "123" }, async () => {
     await client.traces.create({ name: "test" });
     // Node.js: ✅ Full context propagation
     // Browser: ⚠️ Basic context, not safe across all async boundaries
   });
   ```

#### Recommended Actions

1. **Update CLI scripts** if using `evalai eval run`
2. **Test browser builds** if using SDK in browsers
3. **Review trace counts** if you have monitoring based on trace volume
4. **Update dependencies**: Run `npm update @evalai/sdk`

### 🧪 Testing

All fixes have been:

- ✅ Syntax validated
- ✅ Import paths verified
- ✅ Security tests for path traversal
- ✅ Environment detection tested
- ✅ No linting errors

---

## [1.2.0] - 2025-01-15

### 🎉 Added

- **100% API Coverage** - All backend endpoints now supported
- **Annotations API** - Complete human-in-the-loop evaluation
- **Developer API** - Full API key and webhook management
- **LLM Judge Extended** - Enhanced judge capabilities
- **Organizations API** - Organization details access
- **Enhanced Types** - 40+ new TypeScript interfaces

---

## [1.1.0] - 2025-01-10

### ✨ Added

- Comprehensive evaluation template types
- Organization resource limits tracking
- `getOrganizationLimits()` method

---

## [1.0.0] - 2025-01-01

### 🎉 Initial Release

- Traces, Evaluations, LLM Judge APIs
- Framework integrations (OpenAI, Anthropic)
- Test suite builder
- Context propagation
- Error handling & retries
