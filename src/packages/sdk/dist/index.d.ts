/**
 * AI Evaluation Platform SDK
 *
 * Official TypeScript/JavaScript SDK for the AI Evaluation Platform.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */
export { AIEvalClient } from "./client";
import { AuthenticationError, EvalAIError, NetworkError, RateLimitError, SDKError } from "./errors";
export { EvalAIError, RateLimitError, AuthenticationError, SDKError as ValidationError, // Using SDKError as ValidationError for backward compatibility
NetworkError, };
export { containsAllRequiredFields, containsJSON, containsKeywords, containsLanguage, expect, followsInstructions, hasFactualAccuracy, hasLength, hasNoHallucinations, hasNoToxicity, hasReadabilityScore, hasSentiment, hasValidCodeSyntax, isValidEmail, isValidURL, matchesPattern, matchesSchema, notContainsPII, respondedWithinTime, similarTo, withinRange, } from "./assertions";
import { createContext, EvalContext, getCurrentContext, withContext } from "./context";
export { createContext, getCurrentContext as getContext, withContext, EvalContext as ContextManager, };
export { createTestSuite, type TestCaseResult, TestSuite, TestSuiteCase, TestSuiteCaseResult, TestSuiteConfig, TestSuiteResult, } from "./testing";
export { defineEval, evalai, defineSuite, createContext as createEvalContext, createResult, } from "./runtime/eval";
export { createEvalRuntime, getActiveRuntime, setActiveRuntime, disposeActiveRuntime, } from "./runtime/registry";
export { createLocalExecutor, defaultLocalExecutor, } from "./runtime/executor";
export { mergeContexts, cloneContext, validateContext, } from "./runtime/context";
export type { EvalSpec, EvalContext, EvalResult, EvalOptions, EvalRuntime, EvalExecutor, EvalExecutorInterface, LocalExecutor, CloudExecutor, WorkerExecutor, SpecConfig, SpecOptions, DefineEvalFunction, ExecutorCapabilities, } from "./runtime/types";
export { EvalRuntimeError, SpecRegistrationError, SpecExecutionError, RuntimeError, } from "./runtime/types";
import { compareWithSnapshot, snapshot } from "./snapshot";
export { snapshot, compareWithSnapshot, snapshot as saveSnapshot, compareWithSnapshot as compareSnapshots, };
import type { ExportFormat } from "./export";
import { exportData, importData } from "./export";
export { exportData, importData };
export type { ExportFormat, ExportFormat as ExportType };
export { RequestBatcher } from "./batch";
export { CacheTTL, RequestCache } from "./cache";
export { type CheckArgs, EXIT, parseArgs, runCheck } from "./cli/check";
export { traceAnthropic } from "./integrations/anthropic";
export { traceOpenAI } from "./integrations/openai";
export { type OpenAIChatEvalCase, type OpenAIChatEvalOptions, type OpenAIChatEvalResult, openAIChatEval, } from "./integrations/openai-eval";
export { Logger } from "./logger";
export { extendExpectWithToPassGate } from "./matchers";
export { autoPaginate, createPaginatedIterator, decodeCursor, encodeCursor, PaginatedIterator, type PaginatedResponse, type PaginationParams, } from "./pagination";
export { ARTIFACTS, type Baseline, type BaselineTolerance, GATE_CATEGORY, GATE_EXIT, type GateCategory, type GateExitCode, REPORT_SCHEMA_VERSION, type RegressionDelta, type RegressionReport, } from "./regression";
export { batchProcess, batchRead, RateLimiter, streamEvaluation } from "./streaming";
export type { Annotation, AnnotationItem, AnnotationTask, APIKey, APIKeyUsage, APIKeyWithSecret, BatchOptions, ClientConfig as AIEvalConfig, CreateAnnotationItemParams, CreateAnnotationParams, CreateAnnotationTaskParams, CreateAPIKeyParams, CreateLLMJudgeConfigParams, CreateWebhookParams, Evaluation as EvaluationData, ExportOptions, GenericMetadata as AnnotationData, GetLLMJudgeAlignmentParams, GetUsageParams, ImportOptions, ListAnnotationItemsParams, ListAnnotationsParams, ListAnnotationTasksParams, ListAPIKeysParams, ListLLMJudgeConfigsParams, ListLLMJudgeResultsParams, ListWebhookDeliveriesParams, ListWebhooksParams, LLMJudgeAlignment, LLMJudgeConfig, LLMJudgeResult as LLMJudgeData, Organization, RetryConfig, SnapshotData, Span as SpanData, StreamOptions, TestCase, TestResult, Trace as TraceData, TracedResponse, UpdateAPIKeyParams, UpdateWebhookParams, UsageStats, UsageSummary, Webhook, WebhookDelivery, } from "./types";
export { EvaluationTemplates, type EvaluationTemplateType, type FeatureUsage, type OrganizationLimits, } from "./types";
export { type AgentHandoff, type AgentSpanContext, type CostCategory, type CostRecord, createWorkflowTracer, type DecisionAlternative, type DecisionType, type HandoffType, type LLMProvider, type RecordCostParams, type RecordDecisionParams, traceAutoGen, traceCrewAI, traceLangChainAgent, traceWorkflowStep, type WorkflowContext, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode, type WorkflowStatus, WorkflowTracer, type WorkflowTracerOptions, } from "./workflows";
import { AIEvalClient } from "./client";
export default AIEvalClient;
