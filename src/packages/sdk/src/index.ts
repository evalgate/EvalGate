/**
 * AI Evaluation Platform SDK
 * 
 * Official TypeScript/JavaScript SDK for the AI Evaluation Platform.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 * 
 * @packageDocumentation
 */

// Main SDK exports
export { AIEvalClient } from './client'

// Enhanced error handling (Tier 1.5)
import { EvalAIError, RateLimitError, AuthenticationError, NetworkError, SDKError } from './errors';

export { 
  EvalAIError, 
  RateLimitError, 
  AuthenticationError, 
  SDKError as ValidationError, // Using SDKError as ValidationError for backward compatibility
  NetworkError 
}

// Enhanced assertions (Tier 1.3)
export { 
  expect, 
  containsKeywords, 
  matchesPattern, 
  hasLength, 
  containsJSON, 
  notContainsPII, 
  hasSentiment, 
  similarTo, 
  withinRange, 
  isValidEmail, 
  isValidURL, 
  hasNoHallucinations, 
  matchesSchema,
  hasReadabilityScore,
  containsLanguage,
  hasFactualAccuracy,
  respondedWithinTime,
  hasNoToxicity,
  followsInstructions,
  containsAllRequiredFields,
  hasValidCodeSyntax
} from './assertions'

// Context propagation (Tier 2.9)
import { createContext, getCurrentContext, withContext, EvalContext } from './context';

export {
  createContext,
  getCurrentContext as getContext,
  withContext,
  EvalContext as ContextManager
};

// Test suite builder (Tier 2.7)
export { createTestSuite, TestSuite } from './testing'

// Snapshot testing (Tier 2.8)
import { snapshot, compareWithSnapshot } from './snapshot';

export { 
  snapshot, 
  compareWithSnapshot,
  // Aliases for backward compatibility
  snapshot as saveSnapshot,
  compareWithSnapshot as compareSnapshots
}

// Export/Import utilities (Tier 4.18)
import { exportData, importData } from './export';
import type { ExportFormat } from './export';

export { exportData, importData };

// Re-export types for backward compatibility
export type { ExportFormat, ExportFormat as ExportType };

// Streaming and batch processing (Tier 3.3)
// Exporting empty objects for backward compatibility
export const StreamingClient = {};
export const BatchClient = {};

// Debug logger (Tier 4.17)
export { Logger } from './logger'

// Framework integrations (Tier 1.2)
export { traceOpenAI } from './integrations/openai'
export { traceAnthropic } from './integrations/anthropic'

// Types (Tier 1.4)
import type {
  ClientConfig,
  Trace,
  Span,
  Evaluation,
  LLMJudgeResult,
  RetryConfig,
  GenericMetadata,
  TracedResponse,
  TestResult,
  SnapshotData
} from './types';

// Re-export types with backward compatibility
export type {
  ClientConfig as AIEvalConfig,
  Trace as TraceData,
  Span as SpanData,
  Evaluation as EvaluationData,
  LLMJudgeResult as LLMJudgeData,
  RetryConfig,
  GenericMetadata as AnnotationData,
  TracedResponse,
  TestCase,
  TestResult,
  SnapshotData,
  ExportOptions,
  ImportOptions,
  StreamOptions,
  BatchOptions
} from './types'

// New exports for v1.1.0
export { 
  EvaluationTemplates,
  type EvaluationTemplateType,
  type FeatureUsage,
  type OrganizationLimits
} from './types'

// New exports for v1.2.0
export type {
  // Annotations
  Annotation,
  CreateAnnotationParams,
  ListAnnotationsParams,
  AnnotationTask,
  CreateAnnotationTaskParams,
  ListAnnotationTasksParams,
  AnnotationItem,
  CreateAnnotationItemParams,
  ListAnnotationItemsParams,
  // Developer - API Keys
  APIKey,
  APIKeyWithSecret,
  CreateAPIKeyParams,
  UpdateAPIKeyParams,
  ListAPIKeysParams,
  APIKeyUsage,
  // Developer - Webhooks
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  ListWebhooksParams,
  WebhookDelivery,
  ListWebhookDeliveriesParams,
  // Developer - Usage
  UsageStats,
  GetUsageParams,
  UsageSummary,
  // LLM Judge Extended
  LLMJudgeConfig,
  CreateLLMJudgeConfigParams,
  ListLLMJudgeConfigsParams,
  ListLLMJudgeResultsParams,
  LLMJudgeAlignment,
  GetLLMJudgeAlignmentParams,
  // Organizations
  Organization,
} from './types'

// Default export for convenience
import { AIEvalClient } from './client';
export default AIEvalClient;