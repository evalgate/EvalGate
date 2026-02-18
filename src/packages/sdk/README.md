# @pauly4010/evalai-sdk

[![npm version](https://img.shields.io/npm/v/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@pauly4010/evalai-sdk.svg)](https://www.npmjs.com/package/@pauly4010/evalai-sdk)

Evaluate your AI systems locally in 60 seconds. Add an optional CI gate in 2 minutes. No lock-in — remove by deleting the config file.

---

## 1. 60 seconds: Run locally (no account)

Install, run, get a score. No EvalAI account, no API key, no dashboard.

```bash
npm install @pauly4010/evalai-sdk openai
```

```typescript
import { openAIChatEval } from "@pauly4010/evalai-sdk";

await openAIChatEval({
  name: "chat-regression",
  cases: [
    { input: "Hello", expectedOutput: "greeting" },
    { input: "2 + 2 = ?", expectedOutput: "4" },
  ],
});
```

Set `OPENAI_API_KEY` in your environment. You'll see something like:

```
PASS 2/2  (score: 100)

Tip: Want dashboards and history?
Set EVALAI_API_KEY and connect this to the platform.
```

With failures you get `FAIL 9/10 (score 90)`, failed cases listed, and a hint: `Gate this in CI: npx -y @pauly4010/evalai-sdk@^1 init`.

---

## 2. Optional: Add a CI gate (2 minutes)

When you're ready to gate PRs on quality:

```bash
npx -y @pauly4010/evalai-sdk@^1 init
```

**Create an evaluation in the dashboard → paste its ID into `evalai.config.json`:**

```json
{ "evaluationId": "42" }
```

Then add to your CI:

```yaml
- name: EvalAI gate
  env:
    EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}
  run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import
```

You'll get GitHub annotations + a step summary + a dashboard link.

- `--format github` — Annotations and step summary in GitHub Actions
- `--onFail import` — On failure, EvalAI imports the run metadata + failures into the dashboard (idempotent per CI run)

---

## 3. No lock-in

To stop using EvalAI: delete `evalai.config.json`. Your local `openAIChatEval` runs work the same without it. No account cancellation, no data export.

---

## Installation

```bash
npm install @pauly4010/evalai-sdk openai
# or
yarn add @pauly4010/evalai-sdk openai
# or
pnpm add @pauly4010/evalai-sdk openai
```

## Environment Support

This SDK works in both **Node.js** and **browsers**, with some features having specific requirements:

### ✅ Works Everywhere (Node.js + Browser)

- Traces API
- Evaluations API
- LLM Judge API
- Annotations API
- Developer API (API Keys, Webhooks, Usage)
- Organizations API
- Assertions Library
- Test Suites
- Error Handling

### 🟡 Node.js Only Features

The following features require Node.js and **will not work in browsers**:

- **Snapshot Testing** - Uses filesystem for storage
- **Local Storage Mode** - Uses filesystem for offline development
- **CLI Tool** - Command-line interface
- **Export to File** - Direct file system writes

### 🔄 Context Propagation

- **Node.js**: Full async context propagation using `AsyncLocalStorage`
- **Browser**: Basic context support (not safe across all async boundaries)

Use appropriate features based on your environment. The SDK will throw helpful errors if you try to use Node.js-only features in a browser.

## AIEvalClient (Platform API)

```typescript
import { AIEvalClient } from "@pauly4010/evalai-sdk";

// Initialize with environment variables
const client = AIEvalClient.init();

// Or with explicit config
const client = new AIEvalClient({
  apiKey: "your-api-key",
  organizationId: 123,
  debug: true,
});
```

## Features

### 🎯 Evaluation Templates (v1.1.0)

The SDK now includes comprehensive evaluation template types for different testing scenarios:

```typescript
import { EvaluationTemplates } from "@pauly4010/evalai-sdk";

// Create evaluations with predefined templates
await client.evaluations.create({
  name: "Prompt Optimization Test",
  type: EvaluationTemplates.PROMPT_OPTIMIZATION,
  createdBy: userId,
});

// Available templates:
// Core Testing
EvaluationTemplates.UNIT_TESTING;
EvaluationTemplates.OUTPUT_QUALITY;

// Advanced Evaluation
EvaluationTemplates.PROMPT_OPTIMIZATION;
EvaluationTemplates.CHAIN_OF_THOUGHT;
EvaluationTemplates.LONG_CONTEXT_TESTING;
EvaluationTemplates.MODEL_STEERING;
EvaluationTemplates.REGRESSION_TESTING;
EvaluationTemplates.CONFIDENCE_CALIBRATION;

// Safety & Compliance
EvaluationTemplates.SAFETY_COMPLIANCE;

// Domain-Specific
EvaluationTemplates.RAG_EVALUATION;
EvaluationTemplates.CODE_GENERATION;
EvaluationTemplates.SUMMARIZATION;
```

### 📊 Organization Resource Limits (v1.1.0)

Track your organization's resource usage and limits:

```typescript
// Get current usage and limits
const limits = await client.getOrganizationLimits();

console.log("Traces:", {
  usage: limits.traces_per_organization?.usage,
  balance: limits.traces_per_organization?.balance,
  total: limits.traces_per_organization?.included_usage,
});

console.log("Evaluations:", {
  usage: limits.evals_per_organization?.usage,
  balance: limits.evals_per_organization?.balance,
  total: limits.evals_per_organization?.included_usage,
});

console.log("Annotations:", {
  usage: limits.annotations_per_organization?.usage,
  balance: limits.annotations_per_organization?.balance,
  total: limits.annotations_per_organization?.included_usage,
});
```

### 🔍 Traces

```typescript
// Create a trace
const trace = await client.traces.create({
  name: "User Query",
  traceId: "trace-123",
  metadata: { userId: "456" },
});

// List traces
const traces = await client.traces.list({
  limit: 10,
  status: "success",
});

// Create spans
const span = await client.traces.createSpan(trace.id, {
  name: "LLM Call",
  spanId: "span-456",
  startTime: new Date().toISOString(),
  metadata: { model: "gpt-4" },
});
```

### 📝 Evaluations

```typescript
// Create evaluation
const evaluation = await client.evaluations.create({
  name: "Chatbot Responses",
  type: EvaluationTemplates.OUTPUT_QUALITY,
  description: "Test chatbot response quality",
  createdBy: userId,
});

// Add test cases
await client.evaluations.createTestCase(evaluation.id, {
  input: "What is the capital of France?",
  expectedOutput: "Paris",
});

// Run evaluation
const run = await client.evaluations.createRun(evaluation.id, {
  status: "running",
});
```

### ⚖️ LLM Judge

```typescript
// Evaluate with LLM judge
const result = await client.llmJudge.evaluate({
  configId: 1,
  input: "Translate: Hello world",
  output: "Bonjour le monde",
  metadata: { language: "French" },
});

console.log("Score:", result.result.score);
console.log("Reasoning:", result.result.reasoning);
```

## Configuration

### Environment Variables

```bash
# Required
EVALAI_API_KEY=your-api-key

# Optional
EVALAI_ORGANIZATION_ID=123
EVALAI_BASE_URL=https://api.example.com
```

### Client Options

```typescript
const client = new AIEvalClient({
  apiKey: "your-api-key",
  organizationId: 123,
  baseUrl: "https://api.example.com",
  timeout: 30000,
  debug: true,
  logLevel: "debug",
  retry: {
    maxAttempts: 3,
    backoff: "exponential",
    retryableErrors: ["RATE_LIMIT_EXCEEDED", "TIMEOUT"],
  },
});
```

## Error Handling

```typescript
import { EvalAIError, RateLimitError } from '@pauly4010/evalai-sdk';

try {
  await client.traces.create({...});
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof EvalAIError) {
    console.log('Error:', error.code, error.message);
  }
}
```

## Advanced Features

### Context Propagation

```typescript
import { withContext } from "@pauly4010/evalai-sdk";

withContext({ userId: "123", sessionId: "abc" }, async () => {
  // Context automatically included in all traces
  await client.traces.create({
    name: "Query",
    traceId: "trace-1",
  });
});
```

### Test Suites

```typescript
import { createTestSuite } from "@pauly4010/evalai-sdk";

const suite = createTestSuite({
  name: "Chatbot Tests",
  tests: [
    {
      name: "Greeting",
      input: "Hello",
      expectedOutput: "Hi there!",
    },
  ],
});

await suite.run(client);
```

### Framework Integrations

```typescript
import { traceOpenAI } from "@pauly4010/evalai-sdk/integrations/openai";
import OpenAI from "openai";

const openai = traceOpenAI(new OpenAI(), client);

// All OpenAI calls are automatically traced
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }],
});
```

## TypeScript Support

The SDK is fully typed with TypeScript generics for type-safe metadata:

```typescript
interface CustomMetadata {
  userId: string;
  sessionId: string;
  model: string;
}

const trace = await client.traces.create<CustomMetadata>({
  name: "Query",
  traceId: "trace-1",
  metadata: {
    userId: "123",
    sessionId: "abc",
    model: "gpt-4",
  },
});

// TypeScript knows the exact metadata type
console.log(trace.metadata.userId);
```

## 📋 Annotations API (v1.2.0)

Human-in-the-loop evaluation for quality assurance:

```typescript
// Create an annotation
const annotation = await client.annotations.create({
  evaluationRunId: 123,
  testCaseId: 456,
  rating: 5,
  feedback: "Excellent response!",
  labels: { category: "helpful", sentiment: "positive" },
});

// List annotations
const annotations = await client.annotations.list({
  evaluationRunId: 123,
});

// Annotation Tasks
const task = await client.annotations.tasks.create({
  name: "Q4 Quality Review",
  type: "classification",
  organizationId: 1,
  instructions: "Rate responses from 1-5",
});

const tasks = await client.annotations.tasks.list({
  organizationId: 1,
  status: "pending",
});

const taskDetail = await client.annotations.tasks.get(taskId);

// Annotation Items
const item = await client.annotations.tasks.items.create(taskId, {
  content: "Response to evaluate",
  annotation: { rating: 4, category: "good" },
});

const items = await client.annotations.tasks.items.list(taskId);
```

## 🔑 Developer API (v1.2.0)

Manage API keys, webhooks, and monitor usage:

### API Keys

```typescript
// Create an API key
const { apiKey, id, keyPrefix } = await client.developer.apiKeys.create({
  name: "Production Key",
  organizationId: 1,
  scopes: ["traces:read", "traces:write", "evaluations:read"],
  expiresAt: "2025-12-31T23:59:59Z",
});

// IMPORTANT: Save the apiKey securely - it's only shown once!

// List API keys
const keys = await client.developer.apiKeys.list({
  organizationId: 1,
});

// Update an API key
await client.developer.apiKeys.update(keyId, {
  name: "Updated Name",
  scopes: ["traces:read"],
});

// Revoke an API key
await client.developer.apiKeys.revoke(keyId);

// Get usage statistics for a key
const usage = await client.developer.apiKeys.getUsage(keyId);
console.log("Total requests:", usage.totalRequests);
console.log("By endpoint:", usage.usageByEndpoint);
```

### Webhooks

```typescript
// Create a webhook
const webhook = await client.developer.webhooks.create({
  organizationId: 1,
  url: "https://your-app.com/webhooks/evalai",
  events: ["trace.created", "evaluation.completed", "annotation.created"],
});

// List webhooks
const webhooks = await client.developer.webhooks.list({
  organizationId: 1,
  status: "active",
});

// Get a specific webhook
const webhookDetail = await client.developer.webhooks.get(webhookId);

// Update a webhook
await client.developer.webhooks.update(webhookId, {
  url: "https://new-url.com/webhooks",
  events: ["trace.created"],
  status: "inactive",
});

// Delete a webhook
await client.developer.webhooks.delete(webhookId);

// Get webhook deliveries (for debugging)
const deliveries = await client.developer.webhooks.getDeliveries(webhookId, {
  limit: 50,
  success: false, // Only failed deliveries
});
```

### Usage Analytics

```typescript
// Get detailed usage statistics
const stats = await client.developer.getUsage({
  organizationId: 1,
  startDate: "2025-01-01",
  endDate: "2025-01-31",
});

console.log("Traces:", stats.traces.total);
console.log("Evaluations by type:", stats.evaluations.byType);
console.log("API calls by endpoint:", stats.apiCalls.byEndpoint);

// Get usage summary
const summary = await client.developer.getUsageSummary(organizationId);
console.log("Current period:", summary.currentPeriod);
console.log("Limits:", summary.limits);
```

## ⚖️ LLM Judge Extended (v1.2.0)

Enhanced LLM judge configuration and analysis:

```typescript
// Create a judge configuration
const config = await client.llmJudge.createConfig({
  name: "GPT-4 Accuracy Judge",
  description: "Evaluates factual accuracy",
  model: "gpt-4",
  rubric: "Score 1-10 based on factual accuracy...",
  temperature: 0.3,
  maxTokens: 500,
  organizationId: 1,
  createdBy: userId,
});

// List configurations
const configs = await client.llmJudge.listConfigs({
  organizationId: 1,
});

// List results
const results = await client.llmJudge.listResults({
  configId: config.id,
  evaluationId: 123,
});

// Get alignment analysis
const alignment = await client.llmJudge.getAlignment({
  configId: config.id,
  startDate: "2025-01-01",
  endDate: "2025-01-31",
});

console.log("Average score:", alignment.averageScore);
console.log("Accuracy:", alignment.alignmentMetrics.accuracy);
console.log("Agreement with human:", alignment.comparisonWithHuman?.agreement);
```

## 🏢 Organizations API (v1.2.0)

Manage organization details:

```typescript
// Get current organization
const org = await client.organizations.getCurrent();
console.log("Organization:", org.name);
console.log("Plan:", org.plan);
console.log("Status:", org.status);
```

## evalai CLI (v1.5.0)

The SDK includes a CLI for CI/CD evaluation gates. Install globally or use via `npx`:

```bash
# Via npx (no global install)
npx -y @pauly4010/evalai-sdk@^1 check --minScore 92 --evaluationId 42 --apiKey $EVALAI_API_KEY

# Or install globally
npm install -g @pauly4010/evalai-sdk
evalai check --minScore 92 --evaluationId 42
```

### evalai check

Gate deployments on quality scores, regression, and compliance:

| Option | Description |
|--------|-------------|
| `--evaluationId <id>` | **Required.** Evaluation to gate on |
| `--apiKey <key>` | API key (or `EVALAI_API_KEY` env) |
| `--format <fmt>` | `human` (default), `json`, or `github` (annotations + step summary) |
| `--onFail import` | When gate fails, import run with CI context for debugging |
| `--explain` | Show score breakdown and thresholds |
| `--minScore <n>` | Fail if score &lt; n (0–100) |
| `--maxDrop <n>` | Fail if score dropped &gt; n from baseline |
| `--minN <n>` | Fail if total test cases &lt; n |
| `--allowWeakEvidence` | Permit weak evidence level |
| `--policy <name>` | Enforce HIPAA, SOC2, GDPR, PCI_DSS, FINRA_4511 |
| `--baseline <mode>` | `published`, `previous`, or `production` |
| `--baseUrl <url>` | API base URL |

**Exit codes:** 0=pass, 1=score below, 2=regression, 3=policy violation, 4=API error, 5=bad args, 6=low N, 7=weak evidence

### evalai doctor

Verify CI/CD setup before running check:

```bash
npx -y @pauly4010/evalai-sdk@^1 doctor --evaluationId 42 --apiKey $EVALAI_API_KEY
```

Uses the same quality endpoint as `check` — if doctor passes, check works.

## Changelog

### v1.5.0 (Latest)

- **`--format github`** — Annotations + step summary in GitHub Actions
- **`--format json`** — Machine-readable output
- **`--onFail import`** — Import failing runs to dashboard (idempotent per CI run)
- **`--explain`** — Score breakdown and thresholds
- **`evalai doctor`** — Verify CI setup
- **Pinned invocation** — Use `npx -y @pauly4010/evalai-sdk@^1` for stable CI
- **README** — 3-section adoption flow (60s local → CI gate → no lock-in)

### v1.4.1

- **evalai check `--baseline production`** — Compare against latest prod-tagged run
- **Package hardening** — Leaner npm publish with `files`, `sideEffects: false`

### v1.4.0

- **evalai CLI** — Command-line tool for CI/CD evaluation gates
  - `evalai check` — Gate deployments on quality scores, regression, and compliance
  - `--minScore <n>` — Fail if quality score &lt; n (0–100)
  - `--maxDrop <n>` — Fail if score dropped &gt; n points from baseline
  - `--minN <n>` — Fail if total test cases &lt; n
  - `--allowWeakEvidence` — Permit weak evidence level (default: fail)
  - `--policy <name>` — Enforce compliance (HIPAA, SOC2, GDPR, PCI_DSS, FINRA_4511)
  - `--baseline <mode>` — Compare to `published` or `previous` run
  - `--evaluationId <id>` — Required. Evaluation to gate on
  - Environment: `EVALAI_API_KEY`, `EVALAI_BASE_URL`
  - Exit codes: 0=pass, 1=score below, 2=regression, 3=policy violation, 4=API error, 5=bad args, 6=low N, 7=weak evidence
- **CLI Exports** — `parseArgs`, `runCheck`, `EXIT` from `@pauly4010/evalai-sdk` for programmatic use

### v1.3.0

- **Workflow Tracing** — Multi-agent orchestration with full lifecycle instrumentation
  - `WorkflowTracer` class with `startWorkflow`, `endWorkflow`, `startAgentSpan`, `endAgentSpan`
  - `createWorkflowTracer` convenience factory
  - `traceWorkflowStep` generic wrapper for any async function
  - Agent handoff recording (`delegation`, `escalation`, `parallel`, `fallback`)
  - Decision auditing with alternatives, confidence scores, reasoning, and context factors
  - Cost tracking per span/workflow with automatic pricing (16+ models)
  - Cost breakdown by category (`llm`, `tool`, `embedding`, `other`)
- **Framework Integrations** — Wrap popular multi-agent frameworks:
  - `traceLangChainAgent` — wraps `.invoke()` and `.call()` with auto-tracing
  - `traceCrewAI` — wraps `.kickoff()` with workflow start/end
  - `traceAutoGen` — wraps `.initiate_chat()` with workflow start/end
- **Performance Utilities**
  - `RequestCache` with configurable TTL (`CacheTTL` presets)
  - `PaginatedIterator` / `createPaginatedIterator` / `autoPaginate` for cursor-based pagination
  - `RequestBatcher` for batching API calls
  - `RateLimiter` client-side rate limit handling
- **Cost Tracking Types** — `CostRecord`, `CostBreakdown`, `ProviderPricing` interfaces
- **Agent Decision Auditing Types** — `AgentDecision`, `DecisionAlternative`, `RecordDecisionParams` interfaces
- **Benchmark Types** — `Benchmark`, `BenchmarkResult`, `AgentConfig` interfaces

### v1.2.1 (Bug Fixes)

- 🐛 **Critical Fixes**
  - Fixed CLI import paths for proper npm package distribution
  - Fixed duplicate trace creation in OpenAI/Anthropic integrations
  - Fixed Commander.js command structure
  - Added browser/Node.js environment detection and helpful errors
  - Fixed context system to work in both Node.js and browsers
  - Added security checks to snapshot path sanitization
  - Removed misleading empty exports (StreamingClient, BatchClient)
- 📦 **Dependencies**
  - Updated Commander to v14
  - Added peer dependencies for OpenAI and Anthropic SDKs (optional)
  - Added Node.js engine requirement (>=16.0.0)
- 📚 **Documentation**
  - Clarified Node.js-only vs universal features
  - Added environment support section
  - Updated examples with security best practices

### v1.2.0

- 🎉 **100% API Coverage** - All backend endpoints now supported!
- 📋 **Annotations API** - Complete human-in-the-loop evaluation
  - Create and list annotations
  - Manage annotation tasks
  - Handle annotation items
- 🔑 **Developer API** - Full API key and webhook management
  - CRUD operations for API keys
  - Webhook management with delivery tracking
  - Usage analytics and monitoring
- ⚖️ **LLM Judge Extended** - Enhanced judge capabilities
  - Configuration management
  - Results querying
  - Alignment analysis
- 🏢 **Organizations API** - Organization details access
- 📊 **Enhanced Types** - 40+ new TypeScript interfaces
- 📚 **Comprehensive Documentation** - Examples for all new features

### v1.1.0

- ✨ Added comprehensive evaluation template types
- ✨ Added organization resource limits tracking
- ✨ Added `getOrganizationLimits()` method
- 📚 Enhanced documentation with new features

### v1.0.0

- 🎉 Initial release
- ✅ Traces, Evaluations, LLM Judge APIs
- ✅ Framework integrations (OpenAI, Anthropic)
- ✅ Test suite builder
- ✅ Context propagation
- ✅ Error handling & retries

## License

MIT

## Support

- Documentation: https://v0-ai-evaluation-platform-nu.vercel.app/documentation
- Issues: https://github.com/pauly7610/ai-evaluation-platform/issues
