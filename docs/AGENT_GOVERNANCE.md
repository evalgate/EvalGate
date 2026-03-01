# Agent Governance Framework

## Overview

EvalGate's orchestration layer provides enterprise-grade governance for multi-agent AI systems. This framework enables organizations to deploy, monitor, audit, and optimize AI agents with full compliance and cost visibility.

## Table of Contents

- [Compliance Features](#compliance-features)
- [Governance Rules](#governance-rules)
- [Access Control](#access-control)
- [Cost Controls](#cost-controls)
- [SLA Management](#sla-management)
- [Architecture Patterns](#architecture-patterns)
- [Integration Examples](#integration-examples)
- [API Reference](#api-reference)

---

## Compliance Features

### Audit Trails

Every agent decision includes comprehensive audit data:

| Field | Description |
|-------|-------------|
| **Reasoning Chain** | Full explanation of why this decision was made over alternatives |
| **Confidence Scores** | 0-100 scale indicating decision certainty |
| **Cost Attribution** | Per-agent, per-model cost breakdown |
| **Execution Timestamps** | Precise timing for regulatory reporting |
| **Alternative Analysis** | What other options were considered and why they were rejected |

```typescript
// Example decision record
{
  agent: "RouterAgent",
  decisionType: "route",
  chosen: "technical_support",
  confidence: 85,
  alternatives: [
    { action: "billing_support", confidence: 0.3, reasoning: "No billing keywords" },
    { action: "general_support", confidence: 0.1, reasoning: "Fallback option" }
  ],
  reasoning: "Query contains technical terms: 'API', 'error', 'endpoint'",
  timestamp: "2024-01-15T10:30:00Z"
}
```

### Supported Compliance Standards

| Standard | Description | Configuration |
|----------|-------------|---------------|
| **SOC2** | Service Organization Control | `auditLevel: 'SOC2'` |
| **GDPR** | EU Data Protection | `auditLevel: 'GDPR'` |
| **HIPAA** | Healthcare Data | `auditLevel: 'HIPAA'` |
| **FINRA 4511** | Financial Services | `auditLevel: 'FINRA_4511'` |
| **PCI DSS** | Payment Card Industry | `auditLevel: 'PCI_DSS'` |

---

## Governance Rules

### Configuration

```typescript
import { GovernanceEngine, CompliancePresets } from '@/lib/governance/rules';

// Use a compliance preset
const governance = new GovernanceEngine(CompliancePresets.SOC2);

// Or configure custom rules
const governance = new GovernanceEngine({
  confidenceThreshold: 0.7,        // Require approval below 70% confidence
  amountThreshold: 500,            // Require approval for transactions > $500
  requireApprovalForSensitiveData: true,
  requireApprovalForPII: true,
  allowedModels: ['gpt-4', 'claude-sonnet-4'],
  maxCostPerRun: 5.00,
  auditLevel: 'FINRA_4511'
});
```

### Approval Rules

Decisions automatically require human approval when:

1. **Low Confidence**: Decision confidence below threshold (default: 70%)
2. **High Value**: Transaction amount exceeds threshold (default: $500)
3. **Sensitive Data**: Context contains sensitive information
4. **PII Detected**: Personally identifiable information in context
5. **Restricted Classification**: Data marked as "restricted"

```typescript
import { needsApproval } from '@/lib/governance/rules';

const decision = {
  agentName: 'PaymentAgent',
  decisionType: 'action',
  chosen: 'process_refund',
  confidence: 0.65,  // Below threshold
  alternatives: [],
  context: {
    amount: 750,     // Above threshold
    sensitiveData: false
  }
};

if (needsApproval(decision)) {
  // Route to human review queue
  await escalateToHuman({ decision, reason: 'Low confidence + high value' });
}
```

### Blocking Rules

Execution is automatically blocked when:

1. **Fraud Risk**: unknown alternative indicates potential fraud with >30% confidence
2. **Security Risk**: Security concerns detected with >40% confidence
3. **Extremely Low Confidence**: Decision confidence below 30%

```typescript
import { shouldBlock } from '@/lib/governance/rules';

const decision = {
  agentName: 'TransactionAgent',
  decisionType: 'action',
  chosen: 'approve_transfer',
  confidence: 0.25,  // Extremely low
  alternatives: [
    { action: 'flag_fraud', confidence: 0.4, reasoning: 'Unusual pattern detected' }
  ],
  context: {}
};

if (shouldBlock(decision)) {
  throw new Error('Execution blocked: Potential fraud risk');
}
```

---

## Access Control

### Workflow-Level Governance

```typescript
workflow.setGovernanceRules({
  // Approval requirements
  requireApproval: (ctx) => ctx.amount > 500 || ctx.sensitiveData,
  
  // Model restrictions
  allowedModels: ['gpt-4', 'claude-sonnet-4'],
  
  // Cost limits
  maxCostPerRun: 5.00,
  
  // Compliance level
  auditLevel: 'FINRA_4511'
});
```

### Agent-Level Permissions

```typescript
const agentConfig = {
  name: 'PaymentProcessor',
  permissions: {
    canAccessPII: false,
    canProcessPayments: true,
    maxTransactionAmount: 1000,
    requiresApprovalAbove: 500,
    allowedTools: ['payment_gateway', 'fraud_check', 'notification']
  }
};
```

---

## Cost Controls

### Per-Workflow Budgets

```typescript
const workflow = await workflowService.create({
  name: 'Customer Support Pipeline',
  slaCostDollars: '2.50',  // Max $2.50 per run
  // ... other config
});
```

### Real-Time Spend Alerting

```typescript
import { checkSLAViolations } from '@/lib/services/benchmark.service';

const result = await checkSLAViolations(workflowRunId);

if (!result.passed) {
  for (const violation of result.violations) {
    if (violation.type === 'cost') {
      await sendAlert({
        type: 'cost_overrun',
        severity: violation.severity,
        message: violation.message
      });
    }
  }
}
```

### Model Fallbacks on Cost Overruns

```typescript
import { executeWithRetry } from '@/lib/workflows/retry';

const result = await executeWithRetry(
  async () => await agent.run(input),
  {
    maxRetries: 3,
    fallbackModel: 'gpt-3.5-turbo',  // Cheaper fallback
    escalateOnFailure: true
  },
  tracer
);
```

### Automatic Pausing at Threshold

```typescript
const governance = new GovernanceEngine({
  maxCostPerRun: 5.00
});

// Check before each LLM call
if (!governance.isCostWithinBudget(currentCost + estimatedCallCost)) {
  throw new Error(`Budget exceeded. Remaining: $${governance.getRemainingBudget(currentCost)}`);
}
```

---

## SLA Management

### Defining SLAs

```typescript
// In workflow definition
const workflow = {
  name: 'Real-Time Support',
  slaLatencyMs: 5000,       // Max 5 seconds
  slaCostDollars: '0.50',   // Max $0.50 per run
  slaErrorRate: 5           // Max 5% error rate
};
```

### Monitoring SLA Compliance

```typescript
import { getWorkflowSLAStatus } from '@/lib/services/benchmark.service';

const status = await getWorkflowSLAStatus(workflowId);

console.log(`Compliance Rate: ${status.complianceRate}%`);
console.log(`Recent Violations: ${status.recentViolations}`);
```

### SLA Violation Types

| Type | Description | Severity Calculation |
|------|-------------|---------------------|
| `latency` | Execution time exceeded | >50% over = critical |
| `cost` | Run cost exceeded | >50% over = critical |
| `error_rate` | Too munknown failures | >150% of threshold = critical |

---

## Architecture Patterns

### Pattern 1: Sequential Handoffs

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│  Validator  │───▶│  Processor  │───▶│ Notification │
└─────────────┘    └─────────────┘    └──────────────┘
```

```typescript
const workflow = {
  nodes: [
    { id: 'validator', type: 'agent', name: 'InputValidator' },
    { id: 'processor', type: 'agent', name: 'DataProcessor' },
    { id: 'notifier', type: 'agent', name: 'NotificationAgent' }
  ],
  edges: [
    { from: 'validator', to: 'processor' },
    { from: 'processor', to: 'notifier' }
  ],
  entrypoint: 'validator'
};
```

### Pattern 2: Parallel Execution

```
                    ┌─────────────┐
               ┌───▶│ Risk Check  │───┐
               │    └─────────────┘   │
┌─────────┐    │    ┌─────────────┐   │    ┌──────────┐
│  Input  │───▶├───▶│ Fraud Check │───┼───▶│ Aggregator│
└─────────┘    │    └─────────────┘   │    └──────────┘
               │    ┌─────────────┐   │
               └───▶│ Compliance  │───┘
                    └─────────────┘
```

```typescript
const workflow = {
  nodes: [
    { id: 'input', type: 'agent', name: 'InputHandler' },
    { id: 'risk', type: 'agent', name: 'RiskCheck' },
    { id: 'fraud', type: 'agent', name: 'FraudCheck' },
    { id: 'compliance', type: 'agent', name: 'ComplianceCheck' },
    { id: 'parallel', type: 'parallel', name: 'ParallelGate' },
    { id: 'aggregator', type: 'agent', name: 'ResultAggregator' }
  ],
  edges: [
    { from: 'input', to: 'parallel' },
    { from: 'parallel', to: 'risk' },
    { from: 'parallel', to: 'fraud' },
    { from: 'parallel', to: 'compliance' },
    { from: 'risk', to: 'aggregator' },
    { from: 'fraud', to: 'aggregator' },
    { from: 'compliance', to: 'aggregator' }
  ],
  entrypoint: 'input'
};
```

### Pattern 3: Human-in-the-Loop

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│  Agent  │───▶│ Proposes │───▶│  Human  │───▶│ Executes │
└─────────┘    └──────────┘    │ Approves│    └──────────┘
                               └─────────┘
```

```typescript
const workflow = {
  nodes: [
    { id: 'agent', type: 'agent', name: 'ProposalAgent' },
    { id: 'decision', type: 'decision', name: 'ApprovalGate' },
    { id: 'human', type: 'human', name: 'HumanReviewer' },
    { id: 'executor', type: 'agent', name: 'ExecutionAgent' }
  ],
  edges: [
    { from: 'agent', to: 'decision' },
    { from: 'decision', to: 'human', condition: 'requires_approval' },
    { from: 'decision', to: 'executor', condition: 'auto_approved' },
    { from: 'human', to: 'executor', condition: 'approved' }
  ],
  entrypoint: 'agent'
};
```

---

## Integration Examples

### LangChain

```typescript
import { traceLangChainAgent } from '@evalgate/sdk/workflows';

const agent = await initializeAgent(tools, model, {
  callbacks: [traceLangChainAgent({
    apiKey: process.env.EVALAI_API_KEY,
    workflowName: 'customer_support_agent'
  })]
});

// Every LangChain execution auto-logs to EvalGate
const result = await agent.invoke({ input: userQuery });
```

### CrewAI (Python)

```python
from evalgate_sdk.workflows import trace_crewai

@trace_crewai(workflow_name='market_research')
class MarketResearchCrew:
    @agent
    def researcher(self):
        return Agent(role='Research Analyst', ...)
    
    @task
    def analyze_competitors(self):
        return Task(description='...', agent=self.researcher())

# Execution is automatically traced
crew = MarketResearchCrew()
result = crew.kickoff()
```

### AutoGen

```typescript
import { traceAutoGen } from '@evalgate/sdk/workflows';

const tracedConversation = traceAutoGen(conversation, tracer, {
  conversationName: 'CodeReview'
});

// All agent interactions are captured
await tracedConversation.initiate_chat(assistant, { message: 'Review this PR' });
```

---

## API Reference

### GovernanceEngine

```typescript
class GovernanceEngine {
  constructor(config?: GovernanceConfig);
  
  evaluate(decision: Decision): GovernanceResult;
  isModelAllowed(model: string): boolean;
  isCostWithinBudget(cost: number): boolean;
  getRemainingBudget(currentCost: number): number;
  setConfig(config: Partial<GovernanceConfig>): void;
  getConfig(): Required<GovernanceConfig>;
}
```

### GovernanceConfig

```typescript
interface GovernanceConfig {
  confidenceThreshold?: number;      // Default: 0.7
  amountThreshold?: number;          // Default: 500
  requireApprovalForSensitiveData?: boolean;  // Default: true
  requireApprovalForPII?: boolean;   // Default: true
  allowedModels?: string[];          // Default: [] (all allowed)
  maxCostPerRun?: number;            // Default: 10.0
  auditLevel?: AuditLevel;           // Default: 'BASIC'
  customApprovalRules?: Array<(decision: Decision) => boolean>;
  customBlockingRules?: Array<(decision: Decision) => boolean>;
}
```

### GovernanceResult

```typescript
interface GovernanceResult {
  requiresApproval: boolean;
  blocked: boolean;
  reasons: string[];
  auditLevel: AuditLevel;
  timestamp: string;
}
```

---

## Best Practices

1. **Start with Compliance Presets**: Use `CompliancePresets.SOC2` or similar as a baseline
2. **Monitor SLA Violations**: Set up alerts for critical violations
3. **Use Fallback Models**: Configure cheaper fallbacks for cost control
4. **Enable Human-in-the-Loop**: For high-stakes decisions, always have human oversight
5. **Audit Regularly**: Review decision logs and patterns monthly
6. **Test Governance Rules**: Validate rules with edge cases before production

---

## Support

- **Documentation**: https://evalgate.com/documentation
- **API Reference**: https://evalgate.com/api-reference
- **Support**: https://github.com/pauly7610/ai-evaluation-platform/issues
