/**
 * Versioned policy packs for evalgate check --policy.
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
export declare const POLICY_PACKS: Record<string, Record<number, PolicyPack>>;
/**
 * Parse --policy flag (e.g. "HIPAA@1" or "HIPAA") and resolve to PolicyPack.
 * Default version is 1 when omitted.
 */
export declare function resolvePolicyPack(spec: string): PolicyPack | null;
/** List valid policy@version specs for error messages */
export declare function getValidPolicyVersions(): string[];
