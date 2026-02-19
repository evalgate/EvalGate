# EvalAI Integration Reference

> Complete technical reference for wiring external projects into the AI Evaluation Platform.
> Generated from source code — every type, endpoint, and method signature below is real.

---

## Table of Contents

1. [SDK Package (`@pauly4010/evalai-sdk`)](#1-sdk-package)
2. [REST API Contracts](#2-rest-api-contracts)
3. [Governance System](#3-governance-system)
4. [Python Integration](#4-python-integration)
5. [Integration Paths](#5-integration-paths)
6. [Quick-Start Recipes](#6-quick-start-recipes)

---

## 1. SDK Package

| Field | Value |
|-------|-------|
| **npm package** | `@pauly4010/evalai-sdk` |
| **Version** | `1.5.0` |
| **Source** | `src/packages/sdk/` |
| **Exports** | `.` (main), `./assertions`, `./testing`, `./integrations/openai`, `./integrations/anthropic` |
| **Peer deps** | `openai ^4.0.0` (optional), `@anthropic-ai/sdk ^0.20.0` (optional) |
| **Node** | `>=16.0.0` |
| **CLI** | `npx evalai` → `./dist/cli/index.js` |

### 1.1 AIEvalClient — Constructor & Auth

```typescript
import { AIEvalClient } from '@pauly4010/evalai-sdk';

// Option A: Zero-config (reads env vars)
// Env: EVALAI_API_KEY, EVALAI_ORGANIZATION_ID, EVALAI_BASE_URL
const client = AIEvalClient.init();

// Option B: Explicit config
const client = new AIEvalClient({
  apiKey: 'your-api-key',           // required (or EVALAI_API_KEY env)
  organizationId: 123,              // optional (or EVALAI_ORGANIZATION_ID env)
  baseUrl: 'https://your-app.vercel.app', // defaults to '' in browser, 'http://localhost:3000' in Node
  timeout: 30000,                   // ms, default 30s
  debug: false,                     // enables verbose logging
  logLevel: 'info',                 // 'debug' | 'info' | 'warn' | 'error'
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',         // 'exponential' | 'linear' | 'fixed'
    retryableErrors: ['RATE_LIMIT_EXCEEDED', 'TIMEOUT', 'NETWORK_ERROR', 'INTERNAL_SERVER_ERROR']
  },
  enableBatching: true,             // auto-batch requests
  batchSize: 10,
  batchDelay: 50,                   // ms
  cacheSize: 1000,                  // GET request cache entries
});
```

**Auth pattern**: Every request sends `Authorization: Bearer <apiKey>` header.

### 1.2 Client API Modules

```
client.traces          → TraceAPI
client.evaluations     → EvaluationAPI
client.llmJudge        → LLMJudgeAPI
client.annotations     → AnnotationsAPI
client.developer       → DeveloperAPI (apiKeys, webhooks, usage)
client.organizations   → OrganizationsAPI
```

### 1.3 TraceAPI Methods

```typescript
// Create a trace
client.traces.create({
  name: string,
  traceId: string,
  organizationId?: number,  // falls back to client's orgId
  status?: string,          // 'pending' | 'success' | 'error'
  durationMs?: number,
  metadata?: Record<string, any>,
}) → Promise<Trace>

// List traces
client.traces.list({
  limit?: number,       // max 100
  offset?: number,
  organizationId?: number,
  status?: string,
  search?: string,
}) → Promise<Trace[]>

// Get single trace
client.traces.get(id: number) → Promise<Trace>

// Delete trace
client.traces.delete(id: number) → Promise<{ message: string }>

// Create span on a trace
client.traces.createSpan(traceId: number, {
  name: string,
  spanId: string,
  parentSpanId?: string,
  startTime: string,     // ISO 8601
  endTime?: string,
  durationMs?: number,
  metadata?: Record<string, any>,
}) → Promise<Span>

// List spans
client.traces.listSpans(traceId: number) → Promise<Span[]>
```

### 1.4 WorkflowTracer — Full Method Signatures

```typescript
import { WorkflowTracer, createWorkflowTracer } from '@pauly4010/evalai-sdk';

const tracer = new WorkflowTracer(client, {
  organizationId?: number,
  autoCalculateCost?: boolean,    // default true
  tracePrefix?: string,           // default 'workflow'
  captureFullPayloads?: boolean,  // default true
  debug?: boolean,                // default false
});

// — or use the factory —
const tracer = createWorkflowTracer(client, options);
```

#### startWorkflow

```typescript
tracer.startWorkflow(
  name: string,
  definition?: WorkflowDefinition,
  metadata?: Record<string, any>
) → Promise<WorkflowContext>
```

**WorkflowDefinition:**
```typescript
{
  nodes: Array<{
    id: string,
    type: 'agent' | 'tool' | 'decision' | 'parallel' | 'human' | 'llm',
    name: string,
    config?: Record<string, any>,
  }>,
  edges: Array<{
    from: string,
    to: string,
    condition?: string,
    label?: string,
  }>,
  entrypoint: string,
  metadata?: Record<string, any>,
}
```

**WorkflowContext (returned):**
```typescript
{
  id: number,
  traceId: number,
  name: string,
  startedAt: string,       // ISO 8601
  definition?: WorkflowDefinition,
  metadata?: Record<string, any>,
}
```

#### endWorkflow

```typescript
tracer.endWorkflow(
  output?: Record<string, any>,
  status?: 'running' | 'completed' | 'failed' | 'cancelled'  // default 'completed'
) → Promise<void>
```

#### startAgentSpan / endAgentSpan

```typescript
tracer.startAgentSpan(
  agentName: string,
  input?: Record<string, any>,
  parentSpanId?: string
) → Promise<AgentSpanContext>

// AgentSpanContext:
// { spanId, agentName, startTime, parentSpanId?, metadata? }

tracer.endAgentSpan(
  span: AgentSpanContext,
  output?: Record<string, any>,
  error?: string
) → Promise<void>
```

#### recordHandoff

```typescript
tracer.recordHandoff(
  fromAgent: string | undefined,
  toAgent: string,
  context?: Record<string, any>,
  handoffType?: 'delegation' | 'escalation' | 'parallel' | 'fallback'  // default 'delegation'
) → Promise<void>
```

#### recordDecision

```typescript
tracer.recordDecision({
  agent: string,
  type: 'action' | 'tool' | 'delegate' | 'respond' | 'route',
  chosen: string,
  alternatives: Array<{
    action: string,
    confidence: number,      // 0-100
    reasoning?: string,
    rejectedReason?: string,
  }>,
  reasoning?: string,
  confidence?: number,       // 0-100
  contextFactors?: string[],
  inputContext?: Record<string, any>,
}) → Promise<void>
```

#### recordCost

```typescript
tracer.recordCost({
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral' | 'custom' | string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  category?: 'llm' | 'tool' | 'embedding' | 'other',
  isRetry?: boolean,
  retryNumber?: number,
}) → Promise<CostRecord>

// CostRecord adds: totalTokens, inputCost, outputCost, totalCost (all strings, 6 decimal places)
```

**Built-in pricing** (auto-calculated when `autoCalculateCost: true`):

| Provider | Model | Input $/1M | Output $/1M |
|----------|-------|-----------|------------|
| openai | gpt-4 | 30.00 | 60.00 |
| openai | gpt-4-turbo | 10.00 | 30.00 |
| openai | gpt-4o | 5.00 | 15.00 |
| openai | gpt-4o-mini | 0.15 | 0.60 |
| openai | gpt-3.5-turbo | 0.50 | 1.50 |
| anthropic | claude-3-opus | 15.00 | 75.00 |
| anthropic | claude-3-sonnet | 3.00 | 15.00 |
| anthropic | claude-3-haiku | 0.25 | 1.25 |
| anthropic | claude-3.5-sonnet | 3.00 | 15.00 |
| google | gemini-pro | 0.50 | 1.50 |
| google | gemini-1.5-pro | 3.50 | 10.50 |
| google | gemini-1.5-flash | 0.075 | 0.30 |

Unknown models default to $1.00 / $3.00 per million tokens.

#### Utility Methods

```typescript
tracer.getTotalCost() → number
tracer.getCostBreakdown() → { llm: number, tool: number, embedding: number, other: number }
tracer.getCurrentWorkflow() → WorkflowContext | null
tracer.isWorkflowActive() → boolean
tracer.getHandoffs() → AgentHandoff[]
tracer.getDecisions() → RecordDecisionParams[]
tracer.getCosts() → CostRecord[]
```

### 1.5 Framework Integration Wrappers

```typescript
// LangChain
import { traceLangChainAgent } from '@pauly4010/evalai-sdk';
const tracedExecutor = traceLangChainAgent(executor, tracer, { agentName?: string });
// Wraps .invoke() and .call() with automatic span creation

// CrewAI (JS)
import { traceCrewAI } from '@pauly4010/evalai-sdk';
const tracedCrew = traceCrewAI(crew, tracer, { crewName?: string });
// Wraps .kickoff() with automatic workflow start/end

// AutoGen
import { traceAutoGen } from '@pauly4010/evalai-sdk';
const tracedConversation = traceAutoGen(conversation, tracer, { conversationName?: string });
// Wraps .initiate_chat() with automatic workflow start/end

// Helper: trace any async function as a workflow step
import { traceWorkflowStep } from '@pauly4010/evalai-sdk';
const result = await traceWorkflowStep(tracer, 'MyAgent', async () => {
  return await doWork();
}, { input: 'data' });
```

### 1.6 Other SDK Exports

| Export | Purpose |
|--------|---------|
| `expect`, `containsKeywords`, `matchesPattern`, etc. | 18 assertion functions for eval testing |
| `createTestSuite`, `TestSuite` | Test suite builder |
| `snapshot`, `compareWithSnapshot` | Snapshot testing |
| `traceOpenAI`, `traceAnthropic` | LLM provider wrappers |
| `batchProcess`, `streamEvaluation` | Streaming & batch processing |
| `RequestCache`, `PaginatedIterator` | Performance utilities |
| `Logger` | Debug logger |
| `createContext`, `getContext`, `withContext` | Context propagation |
| `exportData`, `importData` | Data export/import |
| `EvalAIError`, `RateLimitError`, `AuthenticationError`, `NetworkError` | Error classes |

---

## 2. REST API Contracts

**Base URL**: Your deployed app (e.g., `https://v0-ai-evaluation-platform-nu.vercel.app`)
**Auth**: `Authorization: Bearer <API_KEY>` header on all requests
**Content-Type**: `application/json`

### 2.1 Traces

#### POST /api/traces — Create trace

```json
// Request body
{
  "name": "Workflow: Customer Support Flow",   // required
  "traceId": "workflow-1706000000-abc123def",  // required, unique string
  "organizationId": 123,                       // required, integer
  "status": "pending",                         // optional: 'pending' | 'success' | 'error'
  "durationMs": 1500,                          // optional
  "metadata": { ... }                          // optional, any JSON
}

// Response 201
{
  "id": 42,
  "name": "Workflow: Customer Support Flow",
  "traceId": "workflow-1706000000-abc123def",
  "organizationId": 123,
  "status": "pending",
  "durationMs": null,
  "metadata": { ... },
  "createdAt": "2026-02-06T04:00:00.000Z"
}
```

#### GET /api/traces

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `organizationId` | int | — | Filter by org |
| `status` | string | — | Filter by status |
| `search` | string | — | Name search (LIKE) |
| `limit` | int | 50 | Max 100 |
| `offset` | int | 0 | Pagination offset |

#### DELETE /api/traces?id={id}

Returns `{ "message": "Trace deleted successfully" }`

### 2.2 Workflows

#### POST /api/workflows — Create workflow

```json
// Request body
{
  "name": "Customer Support Pipeline",         // required, 1-255 chars
  "description": "Routes customer queries",    // optional, max 1000 chars
  "organizationId": 123,                       // required
  "definition": {                              // required
    "nodes": [
      { "id": "router", "type": "agent", "name": "RouterAgent" },
      { "id": "tech", "type": "agent", "name": "TechnicalAgent" },
      { "id": "search", "type": "tool", "name": "WebSearch", "config": {} }
    ],
    "edges": [
      { "from": "router", "to": "tech", "condition": "is_technical", "label": "Technical" },
      { "from": "tech", "to": "search" }
    ],
    "entrypoint": "router",
    "metadata": {}
  },
  "status": "active"                           // optional: 'draft' | 'active' | 'archived'
}

// Response 201 — the created workflow object
```

**Validation rules:**
- `entrypoint` must reference a valid node ID
- All edge `from`/`to` must reference valid node IDs
- Node types: `agent`, `tool`, `decision`, `parallel`, `human`, `llm`

#### GET /api/workflows

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `organizationId` | int | — | **Required** |
| `status` | string | — | `draft` / `active` / `archived` |
| `search` | string | — | Name search |
| `limit` | int | 50 | Max 100 |
| `offset` | int | 0 | Pagination |

#### GET /api/workflows/{id}

| Param | Type | Description |
|-------|------|-------------|
| `organizationId` | int | **Required** (query param) |
| `includeStats` | bool | Include run stats |

#### PUT /api/workflows/{id}

```json
{
  "name": "Updated Name",        // optional
  "description": "Updated desc", // optional
  "definition": { ... },         // optional (same schema as POST)
  "status": "archived"           // optional
}
```

#### DELETE /api/workflows/{id}?organizationId={orgId}

### 2.3 Decisions

#### POST /api/decisions — Create decision

```json
{
  "spanId": 42,                                // required, integer
  "workflowRunId": 7,                          // optional, integer
  "agentName": "RouterAgent",                  // required
  "decisionType": "route",                     // required: 'action' | 'tool' | 'delegate' | 'respond' | 'route'
  "chosen": "technical_support",               // required
  "alternatives": [                            // required, array
    {
      "action": "billing_support",
      "confidence": 30,                        // 0-100
      "reasoning": "No billing keywords",
      "rejectedReason": "Low relevance"
    }
  ],
  "reasoning": "Query contains technical terms",  // optional
  "confidence": 85,                               // optional, 0-100
  "inputContext": { "query": "API error" }        // optional
}

// Response 201 — the created decision object
```

#### GET /api/decisions

| Param | Type | Description |
|-------|------|-------------|
| `id` | int | Get single decision |
| `spanId` | int | List by span |
| `workflowRunId` | int | List by workflow run |
| `agentName` | string | Filter (with workflowRunId) |
| `decisionType` | string | Filter (with workflowRunId) |
| `minConfidence` | int | Filter (with workflowRunId) |
| `includeComparison` | bool | Include comparison data (with id) |
| `limit` | int | Max 100 |
| `offset` | int | Pagination |

**Note:** At least one of `id`, `spanId`, or `workflowRunId` is required.

### 2.4 Costs

#### POST /api/costs — Create cost record

```json
{
  "spanId": 42,                    // required, integer
  "workflowRunId": 7,             // optional, integer
  "provider": "openai",           // required
  "model": "gpt-4",              // required
  "inputTokens": 1500,           // required, non-negative int
  "outputTokens": 800,           // required, non-negative int
  "category": "llm",             // optional: 'llm' | 'tool' | 'embedding' | 'other'
  "isRetry": false,              // optional
  "retryNumber": 0               // optional, non-negative int
}

// Response 201 — includes calculated totalCost
```

#### GET /api/costs

| Param | Type | Description |
|-------|------|-------------|
| `workflowRunId` | int | List costs for a run |
| `traceId` | int | Cost breakdown by trace |
| `organizationId` | int | Org cost summary |
| `breakdown` | bool | Aggregate costs (with workflowRunId) |

**Note:** At least one of `workflowRunId`, `traceId`, or `organizationId` is required.

#### GET /api/costs/trends

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `organizationId` | int | — | **Required** |
| `startDate` | string | 30 days ago | `YYYY-MM-DD` |
| `endDate` | string | today | `YYYY-MM-DD` |

**Response:**
```json
{
  "organizationId": 123,
  "startDate": "2026-01-07",
  "endDate": "2026-02-06",
  "trends": [
    { "date": "2026-01-07", "totalCost": 12.50, "tokenCount": 50000, "requestCount": 25 }
  ],
  "summary": {
    "totalCost": 375.00,
    "totalTokens": 1500000,
    "totalRequests": 750,
    "avgDailyCost": 12.50
  }
}
```

### 2.5 Error Response Format

All errors follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": []  // optional, Zod validation errors
}
```

Common error codes:
| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_REQUIRED_FIELDS` | 400 | Missing name/traceId/organizationId |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `MISSING_ORGANIZATION_ID` | 400 | No org ID provided |
| `INVALID_ID` | 400 | Non-numeric ID |
| `INVALID_ENTRYPOINT` | 400 | Entrypoint doesn't match a node |
| `INVALID_EDGE` | 400 | Edge references non-existent node |
| `MISSING_PARAMETER` | 400 | Required query param missing |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `ORGANIZATION_TRACE_LIMIT_REACHED` | 402 | Upgrade required |
| `ORGANIZATION_WORKFLOW_LIMIT_REACHED` | 402 | Upgrade required |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 3. Governance System

**Source**: `src/lib/governance/rules.ts`

### 3.1 GovernanceEngine

```typescript
import { GovernanceEngine, CompliancePresets } from '@/lib/governance/rules';

const engine = new GovernanceEngine({
  confidenceThreshold: 0.7,        // below this → requires approval
  amountThreshold: 500,            // above this → requires approval
  requireApprovalForSensitiveData: true,
  requireApprovalForPII: true,
  allowedModels: [],               // empty = no restrictions
  maxCostPerRun: 10.0,
  auditLevel: 'SOC2',             // 'BASIC' | 'SOC2' | 'GDPR' | 'HIPAA' | 'FINRA_4511' | 'PCI_DSS'
  customApprovalRules: [],         // Array<(decision) => boolean>
  customBlockingRules: [],
});

const result = engine.evaluate(decision);
// → { requiresApproval: bool, blocked: bool, reasons: string[], auditLevel, timestamp }

engine.isModelAllowed('gpt-4')       → boolean
engine.isCostWithinBudget(5.50)      → boolean
engine.getRemainingBudget(5.50)      → number
```

### 3.2 Compliance Presets

| Preset | Confidence | Amount | Sensitive Data | PII |
|--------|-----------|--------|---------------|-----|
| **BASIC** | 0.6 | $1,000 | No | No |
| **SOC2** | 0.7 | $500 | Yes | Yes |
| **GDPR** | 0.75 | $250 | Yes | Yes |
| **HIPAA** | 0.8 | $100 | Yes | Yes |
| **FINRA_4511** | 0.85 | $100 | Yes | Yes |
| **PCI_DSS** | 0.8 | $50 | Yes | Yes |

```typescript
import { createComplianceGovernance } from '@/lib/governance/rules';
const engine = createComplianceGovernance('SOC2');
```

### 3.3 Blocking Rules

Execution is **blocked** when:
- Any alternative mentions "fraud" with confidence > 0.3
- Any alternative mentions "security" with confidence > 0.4
- Decision confidence < 30%
- Any custom blocking rule returns true

### 3.4 Decision Context Shape

```typescript
{
  amount?: number,
  sensitiveData?: boolean,
  piiDetected?: boolean,
  userTier?: 'free' | 'pro' | 'enterprise',
  region?: string,
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted',
  customFields?: Record<string, any>,
}
```

---

## 4. Python Integration

**Source**: `src/integrations/crewai-example.py`

There is a **full Python EvalAI tracer** implementation in the codebase. It is **not published as a PyPI package** — it's an example/reference implementation that can be copied into your Python project or extracted into a standalone package.

### 4.1 Python EvalAITracer

```python
from evalai_tracer import EvalAITracer, Decision, DecisionAlternative, CostRecord

tracer = EvalAITracer(
    api_key=os.environ['EVALAI_API_KEY'],
    organization_id=123,
    base_url='https://v0-ai-evaluation-platform-nu.vercel.app',
    debug=True
)

# Context manager pattern
with tracer.workflow('Market Research Analysis', {'industry': 'AI/ML'}):
    tracer.record_handoff(None, 'ResearchAnalyst', {'task': 'gather_data'})
    
    tracer.record_decision(Decision(
        agent='ResearchAnalyst',
        type='tool',
        chosen='web_search',
        alternatives=[
            DecisionAlternative('database_query', 0.3, 'Could use internal DB'),
        ],
        reasoning='Web search provides most comprehensive data',
        confidence=85
    ))
    
    tracer.record_cost(CostRecord(
        provider='openai',
        model='gpt-4',
        input_tokens=1500,
        output_tokens=800,
        total_tokens=2300,
        input_cost='0.045000',
        output_cost='0.048000',
        total_cost='0.093000'
    ))

# Manual pattern
tracer.start_workflow('Pipeline')
# ... work ...
tracer.end_workflow(output={'result': 'done'}, status='completed')
```

### 4.2 CrewAI Decorator

```python
from evalai_tracer import trace_crewai

@trace_crewai(workflow_name='market_research')
class MarketResearchCrew:
    @agent
    def researcher(self):
        return Agent(role='Research Analyst', ...)
    
    @task
    def analyze_competitors(self):
        return Task(description='...', agent=self.researcher())

# .kickoff() is automatically traced
crew = MarketResearchCrew()
result = crew.kickoff()
```

### 4.3 Python Governance

```python
from evalai_tracer import GovernanceConfig, check_governance

config = GovernanceConfig(
    confidence_threshold=0.7,
    amount_threshold=500.0,
    require_approval_for_sensitive_data=True,
    allowed_models=[],
    max_cost_per_run=10.0,
    audit_level='SOC2'
)

result = check_governance(decision, config)
# → {'requires_approval': bool, 'blocked': bool, 'reasons': [...], 'audit_level': 'SOC2'}
```

### 4.4 Thin Python HTTP Client (for backends without the example)

If you don't want to copy the full example, here's the minimal HTTP pattern:

```python
import requests

BASE_URL = "https://v0-ai-evaluation-platform-nu.vercel.app"
HEADERS = {
    "Authorization": f"Bearer {os.environ['EVALAI_API_KEY']}",
    "Content-Type": "application/json"
}

# Create trace
trace = requests.post(f"{BASE_URL}/api/traces", headers=HEADERS, json={
    "name": "Workflow: My Pipeline",
    "traceId": f"wf-{int(time.time())}",
    "organizationId": 123,
    "status": "pending",
    "metadata": {"source": "python-backend"}
}).json()

# Create decision
decision = requests.post(f"{BASE_URL}/api/decisions", headers=HEADERS, json={
    "spanId": trace["id"],
    "agentName": "RouterAgent",
    "decisionType": "route",
    "chosen": "technical_support",
    "alternatives": [{"action": "billing", "confidence": 20}],
    "reasoning": "Technical keywords detected",
    "confidence": 85
}).json()

# Record cost
cost = requests.post(f"{BASE_URL}/api/costs", headers=HEADERS, json={
    "spanId": trace["id"],
    "provider": "openai",
    "model": "gpt-4",
    "inputTokens": 1500,
    "outputTokens": 800,
    "category": "llm"
}).json()

# Create workflow
workflow = requests.post(f"{BASE_URL}/api/workflows", headers=HEADERS, json={
    "name": "Customer Support Pipeline",
    "organizationId": 123,
    "definition": {
        "nodes": [
            {"id": "router", "type": "agent", "name": "RouterAgent"},
            {"id": "tech", "type": "agent", "name": "TechAgent"}
        ],
        "edges": [{"from": "router", "to": "tech", "condition": "is_technical"}],
        "entrypoint": "router"
    }
}).json()
```

---

## 5. Integration Paths

### Path A: Python Backend → EvalAI (REST API)

```
┌─────────────────────┐     HTTP POST      ┌─────────────────────────┐
│  Python Backend      │ ──────────────────→│  EvalAI REST API        │
│  (AgentExecutor,     │                    │  /api/traces            │
│   CrewAI, AutoGen)   │  POST /api/traces  │  /api/decisions         │
│                      │  POST /api/decisions│  /api/costs             │
│                      │  POST /api/costs   │  /api/workflows         │
└─────────────────────┘                    └─────────────────────────┘
```

**Use when**: Your agent framework runs in Python. Call the REST endpoints directly with `requests` or `httpx`. No npm SDK needed.

### Path B: JS/TS Frontend → EvalAI (npm SDK)

```
┌─────────────────────┐     npm import     ┌─────────────────────────┐
│  JS/TS App           │ ──────────────────→│  @pauly4010/evalai-sdk  │
│  (Next.js, React,    │                    │  AIEvalClient           │
│   Node.js service)   │  client.traces.*   │  WorkflowTracer         │
│                      │  tracer.*          │  GovernanceEngine       │
└─────────────────────┘                    └─────────────────────────┘
```

**Use when**: Your app is JS/TS. Import the SDK directly for type-safe access, auto-retry, caching, and batching.

### Path C: Hybrid (Python backend + JS dashboard)

```
┌──────────────┐  REST   ┌──────────┐  SDK   ┌──────────────┐
│ Python Agent │ ───────→│  EvalAI  │←───────│ JS Dashboard │
│ Framework    │  POST   │  API     │ import │ (governance, │
│              │         │          │        │  DAG viz,    │
│              │         │          │        │  monitoring) │
└──────────────┘         └──────────┘        └──────────────┘
```

---

## 6. Quick-Start Recipes

### Recipe 1: Instrument a Python agent in 5 lines

```python
import requests, os, time

def trace_agent_call(agent_name, model, input_tokens, output_tokens, decision, chosen):
    base = os.environ["EVALAI_BASE_URL"]
    headers = {"Authorization": f"Bearer {os.environ['EVALAI_API_KEY']}", "Content-Type": "application/json"}
    trace = requests.post(f"{base}/api/traces", headers=headers, json={
        "name": f"Agent: {agent_name}", "traceId": f"py-{int(time.time()*1000)}",
        "organizationId": int(os.environ["EVALAI_ORGANIZATION_ID"]), "status": "success"
    }).json()
    requests.post(f"{base}/api/costs", headers=headers, json={
        "spanId": trace["id"], "provider": "openai", "model": model,
        "inputTokens": input_tokens, "outputTokens": output_tokens
    })
```

### Recipe 2: Full JS workflow tracing

```typescript
import { AIEvalClient, WorkflowTracer } from '@pauly4010/evalai-sdk';

const client = AIEvalClient.init(); // reads EVALAI_API_KEY env
const tracer = new WorkflowTracer(client, { debug: true });

await tracer.startWorkflow('My Pipeline', {
  nodes: [
    { id: 'a1', type: 'agent', name: 'Planner' },
    { id: 'a2', type: 'agent', name: 'Executor' },
  ],
  edges: [{ from: 'a1', to: 'a2' }],
  entrypoint: 'a1',
});

const span = await tracer.startAgentSpan('Planner', { task: 'plan' });
await tracer.recordDecision({
  agent: 'Planner', type: 'delegate', chosen: 'Executor',
  alternatives: [{ action: 'self_execute', confidence: 30 }],
  confidence: 90,
});
await tracer.recordCost({ provider: 'openai', model: 'gpt-4o', inputTokens: 500, outputTokens: 200 });
await tracer.endAgentSpan(span, { plan: 'ready' });

await tracer.recordHandoff('Planner', 'Executor', { plan: 'ready' });

const span2 = await tracer.startAgentSpan('Executor');
await tracer.endAgentSpan(span2, { result: 'done' });

await tracer.endWorkflow({ result: 'success' });
console.log('Total cost:', tracer.getTotalCost());
```

### Recipe 3: LangChain + governance

```typescript
import { AIEvalClient, WorkflowTracer, traceLangChainAgent } from '@pauly4010/evalai-sdk';
import { GovernanceEngine, CompliancePresets } from './lib/governance/rules';

const client = AIEvalClient.init();
const tracer = new WorkflowTracer(client);
const governance = new GovernanceEngine(CompliancePresets.SOC2);

// Wrap your LangChain executor
const tracedAgent = traceLangChainAgent(myExecutor, tracer, { agentName: 'SupportBot' });

// Before executing, check governance
const govResult = governance.evaluate(decision);
if (govResult.blocked) throw new Error(`Blocked: ${govResult.reasons}`);
if (govResult.requiresApproval) await requestHumanApproval(decision);

const result = await tracedAgent.invoke({ input: userQuery });
```

---

## Key Facts

| Question | Answer |
|----------|--------|
| Is there a published Python package? | **No.** There's a reference implementation in `src/integrations/crewai-example.py`. Use it directly or call REST endpoints. |
| What's the npm package name? | `@pauly4010/evalai-sdk` (published on npm) |
| Does the SDK handle auth? | Yes — `Authorization: Bearer <apiKey>` on every request |
| Does the SDK auto-retry? | Yes — up to 3 attempts with exponential backoff for rate limits, timeouts, network errors |
| Does the SDK cache? | Yes — GET requests are cached (configurable size, TTL per endpoint) |
| Is there rate limiting? | Yes — all API routes use `withRateLimit()` middleware |
| What DB is used? | LibSQL (Turso) via Drizzle ORM |
| Where is it deployed? | Vercel (Next.js) |
| GitHub repo | https://github.com/pauly7610/ai-evaluation-platform |

---

*Generated from source files on Feb 6, 2026. All signatures match the actual codebase.*
