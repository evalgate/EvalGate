/**
 * Services barrel — re-exports all service instances and key types.
 * Use: import { evaluationService } from '@/lib/services'
 */

// Aggregate metrics (functions, not class instances)
export {
	addConfidenceBands,
	computeAndStoreQualityScore,
	computeRunAggregates,
	recomputeAndStoreQualityScore,
	wilsonConfidence,
} from "./aggregate-metrics.service";
export { arenaMatchesService } from "./arena-matches.service";
export { auditService } from "./audit.service";
export { benchmarkService } from "./benchmark.service";
export { costService } from "./cost.service";
export { debugAgentService } from "./debug-agent.service";
export { decisionService } from "./decision.service";
export { driftService } from "./drift.service";
export { evaluationService } from "./evaluation.service";
export { llmJudgeService } from "./llm-judge.service";
export { providerKeysService } from "./provider-keys.service";
export { qualityService } from "./quality.service";
export { regressionService } from "./regression.service";
export { reportCardsService } from "./report-cards.service";
export { shadowEvalService } from "./shadow-eval.service";
export { spanService } from "./span.service";
export { testCaseService } from "./test-case.service";
export { traceService } from "./trace.service";
export { versioningService } from "./versioning.service";
export { webhookService } from "./webhook.service";
export { workflowService } from "./workflow.service";
