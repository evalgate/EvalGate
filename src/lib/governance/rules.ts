/**
 * Governance Rules Engine
 * Enterprise-grade governance for multi-agent AI systems
 *
 * Provides configurable rules for:
 * - Approval requirements based on confidence, amount, or sensitivity
 * - Execution blocking for high-risk decisions
 * - Audit level compliance (SOC2, GDPR, FINRA)
 * - Cost controls and model restrictions
 */

import type { DecisionAlternative } from "@/lib/services/decision.service";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Decision context for governance evaluation
 */
export interface Decision {
  id?: number;
  agentName: string;
  decisionType: "action" | "tool" | "delegate" | "respond" | "route";
  chosen: string;
  confidence: number;
  alternatives: DecisionAlternative[];
  reasoning?: string;
  context: DecisionContext;
}

/**
 * Context data that influences governance decisions
 */
export interface DecisionContext {
  amount?: number;
  sensitiveData?: boolean;
  piiDetected?: boolean;
  userTier?: "free" | "pro" | "enterprise";
  region?: string;
  dataClassification?: "public" | "internal" | "confidential" | "restricted";
  customFields?: Record<string, any>;
}

/**
 * Audit compliance levels
 */
export type AuditLevel = "BASIC" | "SOC2" | "GDPR" | "HIPAA" | "FINRA_4511" | "PCI_DSS";

/**
 * Governance rule configuration
 */
export interface GovernanceConfig {
  /** Confidence threshold below which approval is required */
  confidenceThreshold?: number;
  /** Amount threshold above which approval is required */
  amountThreshold?: number;
  /** Always require approval for sensitive data */
  requireApprovalForSensitiveData?: boolean;
  /** Always require approval for PII */
  requireApprovalForPII?: boolean;
  /** Models allowed for this workflow */
  allowedModels?: string[];
  /** Maximum cost per workflow run */
  maxCostPerRun?: number;
  /** Audit compliance level */
  auditLevel?: AuditLevel;
  /** Custom approval rules */
  customApprovalRules?: Array<(decision: Decision) => boolean>;
  /** Custom blocking rules */
  customBlockingRules?: Array<(decision: Decision) => boolean>;
}

/**
 * Result of governance evaluation
 */
export interface GovernanceResult {
  requiresApproval: boolean;
  blocked: boolean;
  reasons: string[];
  auditLevel: AuditLevel;
  timestamp: string;
}

/**
 * SLA violation types
 */
export interface SLAViolation {
  type: "latency" | "cost" | "error_rate" | "throughput";
  threshold: number;
  actual: number;
  severity: "warning" | "critical";
  message: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Required<GovernanceConfig> = {
  confidenceThreshold: 0.7,
  amountThreshold: 500,
  requireApprovalForSensitiveData: true,
  requireApprovalForPII: true,
  allowedModels: [],
  maxCostPerRun: 10.0,
  auditLevel: "BASIC",
  customApprovalRules: [],
  customBlockingRules: [],
};

// ============================================================================
// GOVERNANCE RULES
// ============================================================================

/**
 * Core governance rules for decision evaluation
 */
export const GovernanceRules = {
  /**
   * Check if a decision requires human approval
   */
  requireApprovalFor: (decision: Decision, config: GovernanceConfig = {}): boolean => {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Low confidence decisions require approval
    if (decision.confidence < cfg.confidenceThreshold) {
      return true;
    }

    // High-value transactions require approval
    if (decision.context.amount !== undefined && decision.context.amount > cfg.amountThreshold) {
      return true;
    }

    // Sensitive data handling requires approval
    if (cfg.requireApprovalForSensitiveData && decision.context.sensitiveData === true) {
      return true;
    }

    // PII handling requires approval
    if (cfg.requireApprovalForPII && decision.context.piiDetected === true) {
      return true;
    }

    // Restricted data classification requires approval
    if (decision.context.dataClassification === "restricted") {
      return true;
    }

    // Check custom approval rules
    for (const rule of cfg.customApprovalRules) {
      if (rule(decision)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Check if execution should be blocked entirely
   */
  blockExecution: (decision: Decision, config: GovernanceConfig = {}): boolean => {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Block if any alternative indicates fraud risk
    const hasFraudRisk = decision.alternatives.some(
      (alt) => alt.reasoning?.toLowerCase().includes("fraud") && alt.confidence > 0.3,
    );
    if (hasFraudRisk) {
      return true;
    }

    // Block if any alternative indicates security risk
    const hasSecurityRisk = decision.alternatives.some(
      (alt) => alt.reasoning?.toLowerCase().includes("security") && alt.confidence > 0.4,
    );
    if (hasSecurityRisk) {
      return true;
    }

    // Block extremely low confidence decisions
    if (decision.confidence < 0.3) {
      return true;
    }

    // Check custom blocking rules
    for (const rule of cfg.customBlockingRules) {
      if (rule(decision)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Get detailed reasons for governance decisions
   */
  getApprovalReasons: (decision: Decision, config: GovernanceConfig = {}): string[] => {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const reasons: string[] = [];

    if (decision.confidence < cfg.confidenceThreshold) {
      reasons.push(
        `Low confidence (${(decision.confidence * 100).toFixed(0)}% < ${(cfg.confidenceThreshold * 100).toFixed(0)}% threshold)`,
      );
    }

    if (decision.context.amount !== undefined && decision.context.amount > cfg.amountThreshold) {
      reasons.push(
        `High value transaction ($${decision.context.amount} > $${cfg.amountThreshold} threshold)`,
      );
    }

    if (cfg.requireApprovalForSensitiveData && decision.context.sensitiveData === true) {
      reasons.push("Contains sensitive data");
    }

    if (cfg.requireApprovalForPII && decision.context.piiDetected === true) {
      reasons.push("PII detected in context");
    }

    if (decision.context.dataClassification === "restricted") {
      reasons.push("Restricted data classification");
    }

    return reasons;
  },

  /**
   * Get blocking reasons
   */
  getBlockingReasons: (decision: Decision, _config: GovernanceConfig = {}): string[] => {
    const reasons: string[] = [];

    const hasFraudRisk = decision.alternatives.some(
      (alt) => alt.reasoning?.toLowerCase().includes("fraud") && alt.confidence > 0.3,
    );
    if (hasFraudRisk) {
      reasons.push("Potential fraud risk detected in alternatives");
    }

    const hasSecurityRisk = decision.alternatives.some(
      (alt) => alt.reasoning?.toLowerCase().includes("security") && alt.confidence > 0.4,
    );
    if (hasSecurityRisk) {
      reasons.push("Security risk detected in alternatives");
    }

    if (decision.confidence < 0.3) {
      reasons.push(`Extremely low confidence (${(decision.confidence * 100).toFixed(0)}%)`);
    }

    return reasons;
  },
};

// ============================================================================
// GOVERNANCE ENGINE CLASS
// ============================================================================

/**
 * GovernanceEngine - Evaluate decisions against governance rules
 */
export class GovernanceEngine {
  private config: Required<GovernanceConfig>;

  constructor(config: GovernanceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate a decision against all governance rules
   */
  evaluate(decision: Decision): GovernanceResult {
    const requiresApproval = GovernanceRules.requireApprovalFor(decision, this.config);
    const blocked = GovernanceRules.blockExecution(decision, this.config);

    const reasons: string[] = [
      ...GovernanceRules.getApprovalReasons(decision, this.config),
      ...GovernanceRules.getBlockingReasons(decision, this.config),
    ];

    return {
      requiresApproval,
      blocked,
      reasons,
      auditLevel: this.config.auditLevel,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if a model is allowed
   */
  isModelAllowed(model: string): boolean {
    if (this.config.allowedModels.length === 0) {
      return true; // No restrictions
    }
    return this.config.allowedModels.includes(model);
  }

  /**
   * Check if cost is within budget
   */
  isCostWithinBudget(cost: number): boolean {
    return cost <= this.config.maxCostPerRun;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(currentCost: number): number {
    return Math.max(0, this.config.maxCostPerRun - currentCost);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GovernanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<GovernanceConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// WORKFLOW GOVERNANCE HELPER
// ============================================================================

/**
 * Helper to set governance rules on a workflow
 */
export function createWorkflowGovernance(config: GovernanceConfig): GovernanceEngine {
  return new GovernanceEngine(config);
}

/**
 * Quick check if a decision needs approval (convenience function)
 */
export function needsApproval(decision: Decision, config?: GovernanceConfig): boolean {
  return GovernanceRules.requireApprovalFor(decision, config);
}

/**
 * Quick check if a decision should be blocked (convenience function)
 */
export function shouldBlock(decision: Decision, config?: GovernanceConfig): boolean {
  return GovernanceRules.blockExecution(decision, config);
}

// ============================================================================
// AUDIT COMPLIANCE PRESETS
// ============================================================================

/**
 * Pre-configured governance settings for common compliance requirements
 */
export const CompliancePresets: Record<AuditLevel, GovernanceConfig> = {
  BASIC: {
    confidenceThreshold: 0.6,
    amountThreshold: 1000,
    requireApprovalForSensitiveData: false,
    requireApprovalForPII: false,
    auditLevel: "BASIC",
  },
  SOC2: {
    confidenceThreshold: 0.7,
    amountThreshold: 500,
    requireApprovalForSensitiveData: true,
    requireApprovalForPII: true,
    auditLevel: "SOC2",
  },
  GDPR: {
    confidenceThreshold: 0.75,
    amountThreshold: 250,
    requireApprovalForSensitiveData: true,
    requireApprovalForPII: true,
    auditLevel: "GDPR",
  },
  HIPAA: {
    confidenceThreshold: 0.8,
    amountThreshold: 100,
    requireApprovalForSensitiveData: true,
    requireApprovalForPII: true,
    auditLevel: "HIPAA",
  },
  FINRA_4511: {
    confidenceThreshold: 0.85,
    amountThreshold: 100,
    requireApprovalForSensitiveData: true,
    requireApprovalForPII: true,
    auditLevel: "FINRA_4511",
  },
  PCI_DSS: {
    confidenceThreshold: 0.8,
    amountThreshold: 50,
    requireApprovalForSensitiveData: true,
    requireApprovalForPII: true,
    auditLevel: "PCI_DSS",
  },
};

/**
 * Create a governance engine with a compliance preset
 */
export function createComplianceGovernance(level: AuditLevel): GovernanceEngine {
  return new GovernanceEngine(CompliancePresets[level]);
}
