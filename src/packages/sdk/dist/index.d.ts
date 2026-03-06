/**
 * EvalGate SDK
 *
 * Official TypeScript/JavaScript SDK for EvalGate.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */
export { AIEvalClient } from "./client";
import { AuthenticationError, EvalGateError, NetworkError, RateLimitError, ValidationError } from "./errors";
export { EvalGateError, RateLimitError, AuthenticationError, ValidationError, NetworkError, };
export { type AssertionLLMConfig, configureAssertions, containsAllRequiredFields, containsJSON, containsKeywords, containsLanguage, containsLanguageAsync, expect, followsInstructions, getAssertionConfig, hasConsistency, hasConsistencyAsync, hasFactualAccuracy, hasFactualAccuracyAsync, hasLength, hasNoHallucinations, hasNoHallucinationsAsync, hasNoToxicity, hasNoToxicityAsync, hasPII, hasReadabilityScore, hasSentiment, hasSentimentAsync, hasSentimentWithScore, hasValidCodeSyntax, hasValidCodeSyntaxAsync, isValidEmail, isValidURL, matchesPattern, matchesSchema, notContainsPII, resetSentimentDeprecationWarning, respondedWithinDuration, respondedWithinTime, respondedWithinTimeSince, type SentimentAsyncResult, similarTo, toSemanticallyContain, withinRange, } from "./assertions";
export { EvalGateError as SDKError } from "./errors";
import { createContext, EvalContext, getCurrentContext, withContext } from "./context";
export { createContext, getCurrentContext as getContext, withContext, 
/**
 * Alias for EvalContext class.
 * Note: Stack traces and TypeScript errors will show "EvalContext" as the class name.
 * @see EvalContext
 */
EvalContext as ContextManager, };
export { cloneContext, mergeContexts, validateContext, } from "./runtime/context";
export { createContext as createEvalContext, createResult, defineEval, defineSuite, evalai, getFilteredSpecs, } from "./runtime/eval";
export { createLocalExecutor, defaultLocalExecutor, } from "./runtime/executor";
export { createEvalRuntime, disposeActiveRuntime, getActiveRuntime, setActiveRuntime, } from "./runtime/registry";
export type { CloudExecutor, DefineEvalFunction, EvalContext, EvalExecutor, EvalExecutorInterface, EvalOptions, EvalResult, EvalRuntime, EvalSpec, ExecutorCapabilities, LocalExecutor, SpecConfig, SpecOptions, WorkerExecutor, } from "./runtime/types";
export { EvalRuntimeError, RuntimeError, SpecExecutionError, SpecRegistrationError, } from "./runtime/types";
export { createTestSuite, type TestCaseResult, TestSuite, TestSuiteCase, TestSuiteCaseResult, TestSuiteConfig, TestSuiteResult, } from "./testing";
import { compareSnapshots, compareWithSnapshot, snapshot } from "./snapshot";
export { snapshot, compareWithSnapshot, compareSnapshots, 
/**
 * Alias for snapshot() function. Both refer to the same operation.
 * @deprecated Use snapshot() instead. Will be removed in v4.
 * @see snapshot
 */
snapshot as saveSnapshot, };
import type { ExportFormat } from "./export";
import { exportData, importData } from "./export";
export { exportData, importData };
export type { ExportFormat, ExportFormat as ExportType };
export { RequestBatcher } from "./batch";
export { CacheTTL } from "./cache";
export { computeBaselineChecksum, verifyBaselineChecksum, } from "./cli/baseline";
export { type CheckArgs, EXIT, parseArgs, runCheck } from "./cli/check";
export { type CollectorFeedbackInput, type CollectorSpanInput, type ReportTraceInput, type ReportTraceOptions, type ReportTraceResult, reportTrace, } from "./collector";
export { traceAnthropic } from "./integrations/anthropic";
export { traceOpenAI } from "./integrations/openai";
export { type OpenAIChatEvalCase, type OpenAIChatEvalOptions, type OpenAIChatEvalResult, openAIChatEval, } from "./integrations/openai-eval";
export { Logger } from "./logger";
export { extendExpectWithToPassGate } from "./matchers";
export { createOTelExporter, type OTelAttribute, type OTelEvent, OTelExporter, type OTelExporterOptions, type OTelExportPayload, type OTelSpan, } from "./otel";
export { autoPaginate, autoPaginateGenerator, createPaginatedIterator, decodeCursor, encodeCursor, PaginatedIterator, type PaginatedResponse, type PaginationParams, } from "./pagination";
export { ARTIFACTS, type Baseline, type BaselineTolerance, GATE_CATEGORY, GATE_EXIT, type GateCategory, type GateExitCode, REPORT_SCHEMA_VERSION, type RegressionDelta, type RegressionReport, } from "./regression";
export { batchProcess, batchRead, RateLimiter, streamEvaluation, } from "./streaming";
export type { Annotation, AnnotationItem, AnnotationTask, APIKey, APIKeyUsage, APIKeyWithSecret, BatchOptions, ClientConfig as AIEvalConfig, CreateAnnotationItemParams, CreateAnnotationParams, CreateAnnotationTaskParams, CreateAPIKeyParams, CreateLLMJudgeConfigParams, CreateWebhookParams, Evaluation as EvaluationData, EvaluationRun, EvaluationRunDetail, ExportOptions, GenericMetadata as AnnotationData, GetLLMJudgeAlignmentParams, GetUsageParams, ImportOptions, ListAnnotationItemsParams, ListAnnotationsParams, ListAnnotationTasksParams, ListAPIKeysParams, ListLLMJudgeConfigsParams, ListLLMJudgeResultsParams, ListWebhookDeliveriesParams, ListWebhooksParams, LLMJudgeAlignment, LLMJudgeConfig, LLMJudgeEvaluateResult, LLMJudgeResult as LLMJudgeData, Organization, RetryConfig, SnapshotData, Span as SpanData, StreamOptions, TestCase, TestResult, Trace as TraceData, TraceDetail, TracedResponse, UpdateAPIKeyParams, UpdateWebhookParams, UsageStats, UsageSummary, Webhook, WebhookDelivery, } from "./types";
export { EvaluationTemplates, type EvaluationTemplateType, type FeatureUsage, type OrganizationLimits, } from "./types";
export { type AgentHandoff, type AgentSpanContext, type CostCategory, type CostRecord, createWorkflowTracer, type DecisionAlternative, type DecisionType, type HandoffType, type LLMProvider, type RecordCostParams, type RecordDecisionParams, traceAutoGen, traceCrewAI, traceLangChainAgent, traceWorkflowStep, type WorkflowContext, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode, type WorkflowStatus, WorkflowTracer, type WorkflowTracerOptions, } from "./workflows";
import { AIEvalClient } from "./client";
export default AIEvalClient;
