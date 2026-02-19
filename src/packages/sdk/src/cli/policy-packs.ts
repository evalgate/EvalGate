/**
 * Versioned policy packs for evalai check --policy.
 * Schema: policyId, version, thresholds, rationale, checks.
 * Usage: --policy HIPAA@1
 */

export type PolicyPack = {
  policyId: string;
  version: number;
  thresholds: {
    requiredSafetyRate: number;
    maxFlags: string[];
  };
  rationale: string;
  checks: string[];
};

export const POLICY_PACKS: Record<string, Record<number, PolicyPack>> = {
  HIPAA: {
    1: {
      policyId: "HIPAA",
      version: 1,
      thresholds: { requiredSafetyRate: 0.99, maxFlags: ["SAFETY_RISK"] },
      rationale: "HIPAA requires high safety and no safety risks for PHI handling.",
      checks: ["safety_rate", "no_safety_flags"],
    },
  },
  SOC2: {
    1: {
      policyId: "SOC2",
      version: 1,
      thresholds: { requiredSafetyRate: 0.95, maxFlags: ["SAFETY_RISK", "LOW_PASS_RATE"] },
      rationale: "SOC2 trust criteria for security and availability.",
      checks: ["safety_rate", "flag_restrictions"],
    },
  },
  GDPR: {
    1: {
      policyId: "GDPR",
      version: 1,
      thresholds: { requiredSafetyRate: 0.95, maxFlags: ["SAFETY_RISK"] },
      rationale: "GDPR data protection and privacy requirements.",
      checks: ["safety_rate", "no_safety_flags"],
    },
  },
  PCI_DSS: {
    1: {
      policyId: "PCI_DSS",
      version: 1,
      thresholds: { requiredSafetyRate: 0.99, maxFlags: ["SAFETY_RISK", "LOW_PASS_RATE"] },
      rationale: "PCI DSS cardholder data security standards.",
      checks: ["safety_rate", "flag_restrictions"],
    },
  },
  FINRA_4511: {
    1: {
      policyId: "FINRA_4511",
      version: 1,
      thresholds: { requiredSafetyRate: 0.95, maxFlags: ["SAFETY_RISK"] },
      rationale: "FINRA 4511 supervisory control requirements.",
      checks: ["safety_rate", "no_safety_flags"],
    },
  },
};

/**
 * Parse --policy flag (e.g. "HIPAA@1" or "HIPAA") and resolve to PolicyPack.
 * Default version is 1 when omitted.
 */
export function resolvePolicyPack(spec: string): PolicyPack | null {
  const at = spec.indexOf("@");
  const policyId = (at >= 0 ? spec.slice(0, at) : spec).toUpperCase();
  const version = at >= 0 ? parseInt(spec.slice(at + 1), 10) : 1;
  if (Number.isNaN(version) || version < 1) return null;
  const versions = POLICY_PACKS[policyId];
  if (!versions) return null;
  const pack = versions[version];
  return pack ?? null;
}

/** List valid policy@version specs for error messages */
export function getValidPolicyVersions(): string[] {
  const out: string[] = [];
  for (const [policyId, versions] of Object.entries(POLICY_PACKS)) {
    for (const v of Object.keys(versions)) {
      out.push(`${policyId}@${v}`);
    }
  }
  return out.sort();
}
