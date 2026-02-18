/**
 * CheckReport and related types for formatters.
 */

export type GateVerdict = 'pass' | 'fail';

export type FailureReasonCode =
  | 'LOW_SCORE'
  | 'LOW_PASS_RATE'
  | 'SAFETY_RISK'
  | 'LATENCY_RISK'
  | 'COST_RISK'
  | 'BASELINE_MISSING'
  | 'MAX_DROP_EXCEEDED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'POLICY_VIOLATION'
  | 'UNKNOWN';

export type ScoreBreakdown01 = {
  passRate?: number;
  safety?: number;
  judge?: number;
  schema?: number;
  latency?: number;
  cost?: number;
};

export type ScoreContribPts = {
  passRatePts?: number;
  safetyPts?: number;
  compliancePts?: number;
  performancePts?: number;
};

export type GateThresholds = {
  minScore?: number;
  minPassRate?: number;
  minSafety?: number;
  maxDrop?: number;
  minN?: number;
  allowWeakEvidence?: boolean;
  baseline?: 'published' | 'previous' | 'production';
};

export type FailedCase = {
  testCaseId?: number;
  status?: 'failed' | 'error' | 'skipped' | 'passed';
  name?: string;
  input?: string;
  inputSnippet?: string;
  expectedOutput?: string;
  expectedSnippet?: string;
  output?: string;
  outputSnippet?: string;
  reason?: string;
};

export type CiContext = {
  provider?: 'github' | 'gitlab' | 'circle' | 'unknown';
  repo?: string;
  sha?: string;
  branch?: string;
  pr?: number;
  runUrl?: string;
  actor?: string;
};

export type CheckReport = {
  evaluationId: string;
  runId?: number;
  verdict: GateVerdict;
  reasonCode: FailureReasonCode;
  reasonMessage?: string;
  score?: number;
  baselineScore?: number;
  delta?: number;
  passRate?: number;
  safetyPassRate?: number;
  flags?: string[];
  breakdown01?: ScoreBreakdown01;
  contribPts?: ScoreContribPts;
  thresholds?: GateThresholds;
  n?: number;
  evidenceLevel?: 'strong' | 'medium' | 'weak';
  baselineMissing?: boolean;
  dashboardUrl?: string;
  failedCases?: FailedCase[];
  failedCasesShown?: number;
  failedCasesMore?: number;
  requestId?: string;
  durationMs?: number;
  ci?: CiContext;
  explain?: boolean;
};
