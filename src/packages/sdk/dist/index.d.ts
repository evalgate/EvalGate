/**
 * AI Evaluation Platform SDK
 *
 * Official TypeScript/JavaScript SDK for the AI Evaluation Platform.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */
export { AIEvalClient } from './client';
import { EvalAIError, RateLimitError, AuthenticationError, NetworkError, SDKError } from './errors';
export { EvalAIError, RateLimitError, AuthenticationError, SDKError as ValidationError, // Using SDKError as ValidationError for backward compatibility
NetworkError };
export { expect, containsKeywords, matchesPattern, hasLength, containsJSON, notContainsPII, hasSentiment, similarTo, withinRange, isValidEmail, isValidURL, hasNoHallucinations, matchesSchema, hasReadabilityScore, containsLanguage, hasFactualAccuracy, respondedWithinTime, hasNoToxicity, followsInstructions, containsAllRequiredFields, hasValidCodeSyntax } from './assertions';
import { createContext, getCurrentContext, withContext, EvalContext } from './context';
export { createContext, getCurrentContext as getContext, withContext, EvalContext as ContextManager };
export { createTestSuite, TestSuite } from './testing';
import { snapshot, compareWithSnapshot } from './snapshot';
export { snapshot, compareWithSnapshot, snapshot as saveSnapshot, compareWithSnapshot as compareSnapshots };
import { exportData, importData } from './export';
import type { ExportFormat } from './export';
export { exportData, importData };
export type { ExportFormat, ExportFormat as ExportType };
export declare const StreamingClient: {};
export declare const BatchClient: {};
export { Logger } from './logger';
export { traceOpenAI } from './integrations/openai';
export { traceAnthropic } from './integrations/anthropic';
export type { ClientConfig as AIEvalConfig, Trace as TraceData, Span as SpanData, Evaluation as EvaluationData, LLMJudgeResult as LLMJudgeData, RetryConfig, GenericMetadata as AnnotationData, TracedResponse, TestCase, TestResult, SnapshotData, ExportOptions, ImportOptions, StreamOptions, BatchOptions } from './types';
export { EvaluationTemplates, type EvaluationTemplateType, type FeatureUsage, type OrganizationLimits } from './types';
export type { Annotation, CreateAnnotationParams, ListAnnotationsParams, AnnotationTask, CreateAnnotationTaskParams, ListAnnotationTasksParams, AnnotationItem, CreateAnnotationItemParams, ListAnnotationItemsParams, APIKey, APIKeyWithSecret, CreateAPIKeyParams, UpdateAPIKeyParams, ListAPIKeysParams, APIKeyUsage, Webhook, CreateWebhookParams, UpdateWebhookParams, ListWebhooksParams, WebhookDelivery, ListWebhookDeliveriesParams, UsageStats, GetUsageParams, UsageSummary, LLMJudgeConfig, CreateLLMJudgeConfigParams, ListLLMJudgeConfigsParams, ListLLMJudgeResultsParams, LLMJudgeAlignment, GetLLMJudgeAlignmentParams, Organization, } from './types';
import { AIEvalClient } from './client';
export default AIEvalClient;
