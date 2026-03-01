/**
 * EvalGate SDK
 *
 * Official TypeScript/JavaScript SDK for EvalGate.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */

// Main SDK exports
export { AIEvalClient } from "./client";

// Enhanced error handling (Tier 1.5)
import {
	AuthenticationError,
	EvalGateError,
	NetworkError,
	RateLimitError,
	SDKError,
} from "./errors";

export {
	EvalGateError,
	RateLimitError,
	AuthenticationError,
	SDKError as ValidationError, // Using SDKError as ValidationError for backward compatibility
	NetworkError,
};

// Enhanced assertions (Tier 1.3)
export {
	containsAllRequiredFields,
	containsJSON,
	containsKeywords,
	containsLanguage,
	expect,
	followsInstructions,
	hasFactualAccuracy,
	hasLength,
	hasNoHallucinations,
	hasNoToxicity,
	hasReadabilityScore,
	hasSentiment,
	hasValidCodeSyntax,
	isValidEmail,
	isValidURL,
	matchesPattern,
	matchesSchema,
	notContainsPII,
	respondedWithinTime,
	similarTo,
	withinRange,
} from "./assertions";

// Context propagation (Tier 2.9)
import {
	createContext,
	EvalContext,
	getCurrentContext,
	withContext,
} from "./context";

export {
	createContext,
	getCurrentContext as getContext,
	withContext,
	EvalContext as ContextManager,
};

export {
	cloneContext,
	mergeContexts,
	validateContext,
} from "./runtime/context";

// LAYER 1: Runtime Foundation - NEW PROGRAMMING MODEL
export {
	createContext as createEvalContext,
	createResult,
	defineEval,
	defineSuite,
	evalai,
} from "./runtime/eval";
export {
	createLocalExecutor,
	defaultLocalExecutor,
} from "./runtime/executor";
export {
	createEvalRuntime,
	disposeActiveRuntime,
	getActiveRuntime,
	setActiveRuntime,
} from "./runtime/registry";
// Runtime types for advanced usage
export type {
	CloudExecutor,
	DefineEvalFunction,
	EvalContext,
	EvalExecutor,
	EvalExecutorInterface,
	EvalOptions,
	EvalResult,
	EvalRuntime,
	EvalSpec,
	ExecutorCapabilities,
	LocalExecutor,
	SpecConfig,
	SpecOptions,
	WorkerExecutor,
} from "./runtime/types";
// Runtime errors
export {
	EvalRuntimeError,
	RuntimeError,
	SpecExecutionError,
	SpecRegistrationError,
} from "./runtime/types";
// Test suite builder (Tier 2.7) - BACKWARD COMPATIBILITY LAYER
export {
	createTestSuite,
	// Note: TestCase and TestCaseResult are not exported here to avoid collision
	// with the API TestCase type from './types'. Use TestSuiteCase instead.
	// Legacy alias: type TestCase = TestSuiteCase (available in './testing' module directly)
	type TestCaseResult,
	TestSuite,
	TestSuiteCase,
	TestSuiteCaseResult,
	TestSuiteConfig,
	TestSuiteResult,
} from "./testing";

// Snapshot testing (Tier 2.8)
import { compareWithSnapshot, snapshot } from "./snapshot";

export {
	snapshot,
	compareWithSnapshot,
	// Aliases for backward compatibility
	snapshot as saveSnapshot,
	compareWithSnapshot as compareSnapshots,
};

import type { ExportFormat } from "./export";
// Export/Import utilities (Tier 4.18)
import { exportData, importData } from "./export";

export { exportData, importData };

// Re-export types for backward compatibility
export type { ExportFormat, ExportFormat as ExportType };

// Note: RequestBatcher is for advanced users only
// Most users don't need this - batching is automatic
export { RequestBatcher } from "./batch";

// Performance optimization utilities (v1.3.0)
// Note: RequestCache and CacheTTL are for advanced users only
// Most users don't need these - caching is automatic
export { CacheTTL, RequestCache } from "./cache";
// CLI (programmatic use)
export { type CheckArgs, EXIT, parseArgs, runCheck } from "./cli/check";
export { traceAnthropic } from "./integrations/anthropic";
// Framework integrations (Tier 1.2)
export { traceOpenAI } from "./integrations/openai";
// OpenAI regression eval (local-first, no account required)
export {
	type OpenAIChatEvalCase,
	type OpenAIChatEvalOptions,
	type OpenAIChatEvalResult,
	openAIChatEval,
} from "./integrations/openai-eval";
// Debug logger (Tier 4.17)
export { Logger } from "./logger";
// Vitest matcher: expect(await openAIChatEval(...)).toPassGate()
export { extendExpectWithToPassGate } from "./matchers";
export {
	autoPaginate,
	createPaginatedIterator,
	decodeCursor,
	encodeCursor,
	PaginatedIterator,
	type PaginatedResponse,
	type PaginationParams,
} from "./pagination";
// Regression gate constants & types (v1.6.0)
export {
	ARTIFACTS,
	type Baseline,
	type BaselineTolerance,
	GATE_CATEGORY,
	GATE_EXIT,
	type GateCategory,
	type GateExitCode,
	REPORT_SCHEMA_VERSION,
	type RegressionDelta,
	type RegressionReport,
} from "./regression";
// Streaming and batch processing (Tier 3.3)
// Use functions from ./streaming module instead of these deprecated exports
export {
	batchProcess,
	batchRead,
	RateLimiter,
	streamEvaluation,
} from "./streaming";
// Re-export types with backward compatibility
// New exports for v1.2.0
export type {
	// Annotations
	Annotation,
	AnnotationItem,
	AnnotationTask,
	// Developer - API Keys
	APIKey,
	APIKeyUsage,
	APIKeyWithSecret,
	BatchOptions,
	ClientConfig as AIEvalConfig,
	CreateAnnotationItemParams,
	CreateAnnotationParams,
	CreateAnnotationTaskParams,
	CreateAPIKeyParams,
	CreateLLMJudgeConfigParams,
	CreateWebhookParams,
	Evaluation as EvaluationData,
	EvaluationRun,
	EvaluationRunDetail,
	ExportOptions,
	GenericMetadata as AnnotationData,
	GetLLMJudgeAlignmentParams,
	GetUsageParams,
	ImportOptions,
	ListAnnotationItemsParams,
	ListAnnotationsParams,
	ListAnnotationTasksParams,
	ListAPIKeysParams,
	ListLLMJudgeConfigsParams,
	ListLLMJudgeResultsParams,
	ListWebhookDeliveriesParams,
	ListWebhooksParams,
	LLMJudgeAlignment,
	// LLM Judge Extended
	LLMJudgeConfig,
	LLMJudgeEvaluateResult,
	LLMJudgeResult as LLMJudgeData,
	// Organizations
	Organization,
	RetryConfig,
	SnapshotData,
	Span as SpanData,
	StreamOptions,
	TestCase,
	TestResult,
	Trace as TraceData,
	TraceDetail,
	TracedResponse,
	UpdateAPIKeyParams,
	UpdateWebhookParams,
	// Developer - Usage
	UsageStats,
	UsageSummary,
	// Developer - Webhooks
	Webhook,
	WebhookDelivery,
} from "./types";
// New exports for v1.1.0
export {
	EvaluationTemplates,
	type EvaluationTemplateType,
	type FeatureUsage,
	type OrganizationLimits,
} from "./types";
// Workflow tracing (Orchestration Layer)
export {
	type AgentHandoff,
	type AgentSpanContext,
	type CostCategory,
	type CostRecord,
	createWorkflowTracer,
	type DecisionAlternative,
	type DecisionType,
	type HandoffType,
	type LLMProvider,
	type RecordCostParams,
	type RecordDecisionParams,
	traceAutoGen,
	traceCrewAI,
	// Framework integrations
	traceLangChainAgent,
	traceWorkflowStep,
	type WorkflowContext,
	type WorkflowDefinition,
	type WorkflowEdge,
	// Types
	type WorkflowNode,
	type WorkflowStatus,
	WorkflowTracer,
	type WorkflowTracerOptions,
} from "./workflows";

// Default export for convenience
import { AIEvalClient } from "./client";
export default AIEvalClient;
