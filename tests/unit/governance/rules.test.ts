import { describe, expect, it } from "vitest";
import {
  CompliancePresets,
  createComplianceGovernance,
  createWorkflowGovernance,
  type Decision,
  type DecisionAlternative,
  type DecisionContext,
  type GovernanceConfig,
  GovernanceEngine,
  GovernanceRules,
  needsApproval,
  shouldBlock,
} from "@/lib/governance/rules";

// Mock the external type
const mockAlternative = (
  name: string,
  confidence: number,
  reasoning?: string,
): DecisionAlternative => ({
  name,
  confidence,
  reasoning,
});

describe("GovernanceRules.requireApprovalFor", () => {
  // Happy path tests
  it("should not require approval for high confidence decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(false);
  });

  it("should require approval for low confidence decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.5,
      alternatives: [mockAlternative("option1", 0.5)],
      context: {},
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(true);
  });

  it("should require approval for high amount transaction", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { amount: 1000 },
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(true);
  });

  it("should require approval for sensitive data", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { sensitiveData: true },
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(true);
  });

  it("should require approval for PII detected", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { piiDetected: true },
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(true);
  });

  it("should require approval for restricted data classification", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { dataClassification: "restricted" },
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(true);
  });

  // Edge case tests
  it("should use custom confidence threshold", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.6,
      alternatives: [mockAlternative("option1", 0.6)],
      context: {},
    };
    const config: GovernanceConfig = { confidenceThreshold: 0.5 };
    expect(GovernanceRules.requireApprovalFor(decision, config)).toBe(false);
  });

  it("should use custom amount threshold", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { amount: 200 },
    };
    const config: GovernanceConfig = { amountThreshold: 100 };
    expect(GovernanceRules.requireApprovalFor(decision, config)).toBe(true);
  });

  it("should handle undefined amount", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { amount: undefined },
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(false);
  });

  it("should execute custom approval rules", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    const config: GovernanceConfig = {
      customApprovalRules: [() => true],
    };
    expect(GovernanceRules.requireApprovalFor(decision, config)).toBe(true);
  });

  // Error/invalid input tests
  it("should handle empty decision context", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    expect(GovernanceRules.requireApprovalFor(decision)).toBe(false);
  });
});

describe("GovernanceRules.blockExecution", () => {
  // Happy path tests
  it("should not block normal decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(false);
  });

  it("should block extremely low confidence decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.2,
      alternatives: [mockAlternative("option1", 0.2)],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(true);
  });

  it("should block fraud risk detection", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("fraud detected", 0.4, "potential fraud risk"),
      ],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(true);
  });

  it("should block security risk detection", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("security issue", 0.5, "security vulnerability"),
      ],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(true);
  });

  // Edge case tests
  it("should not block low confidence fraud risk", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("fraud detected", 0.2, "potential fraud risk"),
      ],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(false);
  });

  it("should not block low confidence security risk", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("security issue", 0.3, "security vulnerability"),
      ],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(false);
  });

  it("should execute custom blocking rules", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    const config: GovernanceConfig = {
      customBlockingRules: [() => true],
    };
    expect(GovernanceRules.blockExecution(decision, config)).toBe(true);
  });

  it("should handle case-insensitive risk detection", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("FRAUD RISK", 0.4, "FRAUD DETECTED"),
      ],
      context: {},
    };
    expect(GovernanceRules.blockExecution(decision)).toBe(true);
  });
});

describe("GovernanceRules.getApprovalReasons", () => {
  it("should return empty reasons for normal decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    const reasons = GovernanceRules.getApprovalReasons(decision);
    expect(reasons).toEqual([]);
  });

  it("should return confidence reason", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.5,
      alternatives: [mockAlternative("option1", 0.5)],
      context: {},
    };
    const reasons = GovernanceRules.getApprovalReasons(decision);
    expect(reasons).toContain("Low confidence (50% < 70% threshold)");
  });

  it("should return amount reason", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: { amount: 1000 },
    };
    const reasons = GovernanceRules.getApprovalReasons(decision);
    expect(reasons).toContain("High value transaction ($1000 > $500 threshold)");
  });

  it("should return multiple reasons", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.5,
      alternatives: [mockAlternative("option1", 0.5)],
      context: { amount: 1000, sensitiveData: true },
    };
    const reasons = GovernanceRules.getApprovalReasons(decision);
    expect(reasons).toHaveLength(3);
    expect(reasons).toContain("Low confidence (50% < 70% threshold)");
    expect(reasons).toContain("High value transaction ($1000 > $500 threshold)");
    expect(reasons).toContain("Contains sensitive data");
  });
});

describe("GovernanceRules.getBlockingReasons", () => {
  it("should return empty reasons for normal decision", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [mockAlternative("option1", 0.8)],
      context: {},
    };
    const reasons = GovernanceRules.getBlockingReasons(decision);
    expect(reasons).toEqual([]);
  });

  it("should return low confidence reason", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.2,
      alternatives: [mockAlternative("option1", 0.2)],
      context: {},
    };
    const reasons = GovernanceRules.getBlockingReasons(decision);
    expect(reasons).toContain("Extremely low confidence (20%)");
  });

  it("should return fraud risk reason", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.8,
      alternatives: [
        mockAlternative("option1", 0.8),
        mockAlternative("fraud detected", 0.4, "potential fraud risk"),
      ],
      context: {},
    };
    const reasons = GovernanceRules.getBlockingReasons(decision);
    expect(reasons).toContain("Potential fraud risk detected in alternatives");
  });
});

describe("GovernanceEngine", () => {
  it("should create with default config", () => {
    const engine = new GovernanceEngine();
    const config = engine.getConfig();
    expect(config.confidenceThreshold).toBe(0.7);
    expect(config.amountThreshold).toBe(500);
  });

  it("should create with custom config", () => {
    const config: GovernanceConfig = { confidenceThreshold: 0.5, amountThreshold: 1000 };
    const engine = new GovernanceEngine(config);
    const engineConfig = engine.getConfig();
    expect(engineConfig.confidenceThreshold).toBe(0.5);
    expect(engineConfig.amountThreshold).toBe(1000);
  });

  it("should evaluate decision correctly", () => {
    const engine = new GovernanceEngine();
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.5,
      alternatives: [mockAlternative("option1", 0.5)],
      context: {},
    };
    const result = engine.evaluate(decision);
    expect(result.requiresApproval).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reasons).toContain("Low confidence (50% < 70% threshold)");
    expect(result.auditLevel).toBe("BASIC");
    expect(result.timestamp).toBeDefined();
  });

  it("should check model allowed", () => {
    const engine = new GovernanceEngine({ allowedModels: ["gpt-4", "claude"] });
    expect(engine.isModelAllowed("gpt-4")).toBe(true);
    expect(engine.isModelAllowed("unknown")).toBe(false);
  });

  it("should allow all models when no restrictions", () => {
    const engine = new GovernanceEngine({ allowedModels: [] });
    expect(engine.isModelAllowed("any-model")).toBe(true);
  });

  it("should check cost within budget", () => {
    const engine = new GovernanceEngine({ maxCostPerRun: 10 });
    expect(engine.isCostWithinBudget(5)).toBe(true);
    expect(engine.isCostWithinBudget(15)).toBe(false);
  });

  it("should calculate remaining budget", () => {
    const engine = new GovernanceEngine({ maxCostPerRun: 10 });
    expect(engine.getRemainingBudget(3)).toBe(7);
    expect(engine.getRemainingBudget(15)).toBe(0); // Should not go negative
  });

  it("should update config", () => {
    const engine = new GovernanceEngine();
    engine.setConfig({ confidenceThreshold: 0.9 });
    const config = engine.getConfig();
    expect(config.confidenceThreshold).toBe(0.9);
  });
});

describe("Convenience functions", () => {
  it("should check needs approval", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.5,
      alternatives: [mockAlternative("option1", 0.5)],
      context: {},
    };
    expect(needsApproval(decision)).toBe(true);
  });

  it("should check should block", () => {
    const decision: Decision = {
      agentName: "test-agent",
      decisionType: "action",
      chosen: "option1",
      confidence: 0.2,
      alternatives: [mockAlternative("option1", 0.2)],
      context: {},
    };
    expect(shouldBlock(decision)).toBe(true);
  });

  it("should create workflow governance", () => {
    const config: GovernanceConfig = { confidenceThreshold: 0.8 };
    const engine = createWorkflowGovernance(config);
    expect(engine).toBeInstanceOf(GovernanceEngine);
    expect(engine.getConfig().confidenceThreshold).toBe(0.8);
  });
});

describe("CompliancePresets", () => {
  it("should have correct BASIC preset", () => {
    const preset = CompliancePresets.BASIC;
    expect(preset.confidenceThreshold).toBe(0.6);
    expect(preset.amountThreshold).toBe(1000);
    expect(preset.requireApprovalForSensitiveData).toBe(false);
    expect(preset.auditLevel).toBe("BASIC");
  });

  it("should have correct SOC2 preset", () => {
    const preset = CompliancePresets.SOC2;
    expect(preset.confidenceThreshold).toBe(0.7);
    expect(preset.amountThreshold).toBe(500);
    expect(preset.requireApprovalForSensitiveData).toBe(true);
    expect(preset.auditLevel).toBe("SOC2");
  });

  it("should create compliance governance", () => {
    const engine = createComplianceGovernance("HIPAA");
    expect(engine).toBeInstanceOf(GovernanceEngine);
    expect(engine.getConfig().auditLevel).toBe("HIPAA");
    expect(engine.getConfig().confidenceThreshold).toBe(0.8);
  });
});
