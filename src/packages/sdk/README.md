# @evalai/sdk

Official TypeScript/JavaScript SDK for the AI Evaluation Platform. Build confidence in your AI systems with comprehensive evaluation tools.

## Installation

```bash
npm install @evalai/sdk
# or
yarn add @evalai/sdk
# or
pnpm add @evalai/sdk
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

## Quick Start

```typescript
import { AIEvalClient } from "@evalai/sdk";

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
import { EvaluationTemplates } from "@evalai/sdk";

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
import { EvalAIError, RateLimitError } from '@evalai/sdk';

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
import { withContext } from "@evalai/sdk";

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
import { createTestSuite } from "@evalai/sdk";

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
import { traceOpenAI } from "@evalai/sdk/integrations/openai";
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

## Changelog

### v1.2.1 (Latest - Bug Fixes)

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

- Documentation: https://docs.evalai.com
- Issues: https://github.com/evalai/sdk/issues
- Discord: https://discord.gg/evalai
