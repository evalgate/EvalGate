"use strict";
/**
 * EvalGate SDK
 *
 * Official TypeScript/JavaScript SDK for EvalGate.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContext = exports.mergeContexts = exports.cloneContext = exports.ContextManager = exports.withContext = exports.getContext = exports.createContext = exports.SDKError = exports.withinRange = exports.toSemanticallyContain = exports.similarTo = exports.respondedWithinTimeSince = exports.respondedWithinTime = exports.respondedWithinDuration = exports.notContainsPII = exports.matchesSchema = exports.matchesPattern = exports.isValidURL = exports.isValidEmail = exports.hasValidCodeSyntaxAsync = exports.hasValidCodeSyntax = exports.hasSentimentWithScore = exports.hasSentimentAsync = exports.hasSentiment = exports.hasReadabilityScore = exports.hasPII = exports.hasNoToxicityAsync = exports.hasNoToxicity = exports.hasNoHallucinationsAsync = exports.hasNoHallucinations = exports.hasLength = exports.hasFactualAccuracyAsync = exports.hasFactualAccuracy = exports.hasConsistencyAsync = exports.hasConsistency = exports.getAssertionConfig = exports.followsInstructions = exports.expect = exports.containsLanguageAsync = exports.containsLanguage = exports.containsKeywords = exports.containsJSON = exports.containsAllRequiredFields = exports.configureAssertions = exports.NetworkError = exports.ValidationError = exports.AuthenticationError = exports.RateLimitError = exports.EvalGateError = exports.AIEvalClient = void 0;
exports.streamEvaluation = exports.RateLimiter = exports.batchRead = exports.batchProcess = exports.REPORT_SCHEMA_VERSION = exports.GATE_EXIT = exports.GATE_CATEGORY = exports.ARTIFACTS = exports.PaginatedIterator = exports.encodeCursor = exports.decodeCursor = exports.createPaginatedIterator = exports.autoPaginateGenerator = exports.autoPaginate = exports.OTelExporter = exports.createOTelExporter = exports.extendExpectWithToPassGate = exports.Logger = exports.openAIChatEval = exports.traceOpenAI = exports.traceAnthropic = exports.runCheck = exports.parseArgs = exports.EXIT = exports.CacheTTL = exports.RequestBatcher = exports.importData = exports.exportData = exports.saveSnapshot = exports.compareSnapshots = exports.compareWithSnapshot = exports.snapshot = exports.TestSuite = exports.createTestSuite = exports.SpecRegistrationError = exports.SpecExecutionError = exports.RuntimeError = exports.EvalRuntimeError = exports.setActiveRuntime = exports.getActiveRuntime = exports.disposeActiveRuntime = exports.createEvalRuntime = exports.defaultLocalExecutor = exports.createLocalExecutor = exports.getFilteredSpecs = exports.evalai = exports.defineSuite = exports.defineEval = exports.createResult = exports.createEvalContext = void 0;
exports.WorkflowTracer = exports.traceWorkflowStep = exports.traceLangChainAgent = exports.traceCrewAI = exports.traceAutoGen = exports.createWorkflowTracer = exports.EvaluationTemplates = void 0;
// Main SDK exports
var client_1 = require("./client");
Object.defineProperty(exports, "AIEvalClient", { enumerable: true, get: function () { return client_1.AIEvalClient; } });
// Enhanced error handling (Tier 1.5)
const errors_1 = require("./errors");
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "EvalGateError", { enumerable: true, get: function () { return errors_1.EvalGateError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
// Enhanced assertions (Tier 1.3)
var assertions_1 = require("./assertions");
// LLM config
Object.defineProperty(exports, "configureAssertions", { enumerable: true, get: function () { return assertions_1.configureAssertions; } });
Object.defineProperty(exports, "containsAllRequiredFields", { enumerable: true, get: function () { return assertions_1.containsAllRequiredFields; } });
Object.defineProperty(exports, "containsJSON", { enumerable: true, get: function () { return assertions_1.containsJSON; } });
Object.defineProperty(exports, "containsKeywords", { enumerable: true, get: function () { return assertions_1.containsKeywords; } });
Object.defineProperty(exports, "containsLanguage", { enumerable: true, get: function () { return assertions_1.containsLanguage; } });
// LLM-backed async variants
Object.defineProperty(exports, "containsLanguageAsync", { enumerable: true, get: function () { return assertions_1.containsLanguageAsync; } });
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return assertions_1.expect; } });
Object.defineProperty(exports, "followsInstructions", { enumerable: true, get: function () { return assertions_1.followsInstructions; } });
Object.defineProperty(exports, "getAssertionConfig", { enumerable: true, get: function () { return assertions_1.getAssertionConfig; } });
Object.defineProperty(exports, "hasConsistency", { enumerable: true, get: function () { return assertions_1.hasConsistency; } });
Object.defineProperty(exports, "hasConsistencyAsync", { enumerable: true, get: function () { return assertions_1.hasConsistencyAsync; } });
Object.defineProperty(exports, "hasFactualAccuracy", { enumerable: true, get: function () { return assertions_1.hasFactualAccuracy; } });
Object.defineProperty(exports, "hasFactualAccuracyAsync", { enumerable: true, get: function () { return assertions_1.hasFactualAccuracyAsync; } });
Object.defineProperty(exports, "hasLength", { enumerable: true, get: function () { return assertions_1.hasLength; } });
Object.defineProperty(exports, "hasNoHallucinations", { enumerable: true, get: function () { return assertions_1.hasNoHallucinations; } });
Object.defineProperty(exports, "hasNoHallucinationsAsync", { enumerable: true, get: function () { return assertions_1.hasNoHallucinationsAsync; } });
Object.defineProperty(exports, "hasNoToxicity", { enumerable: true, get: function () { return assertions_1.hasNoToxicity; } });
Object.defineProperty(exports, "hasNoToxicityAsync", { enumerable: true, get: function () { return assertions_1.hasNoToxicityAsync; } });
Object.defineProperty(exports, "hasPII", { enumerable: true, get: function () { return assertions_1.hasPII; } });
Object.defineProperty(exports, "hasReadabilityScore", { enumerable: true, get: function () { return assertions_1.hasReadabilityScore; } });
Object.defineProperty(exports, "hasSentiment", { enumerable: true, get: function () { return assertions_1.hasSentiment; } });
Object.defineProperty(exports, "hasSentimentAsync", { enumerable: true, get: function () { return assertions_1.hasSentimentAsync; } });
Object.defineProperty(exports, "hasSentimentWithScore", { enumerable: true, get: function () { return assertions_1.hasSentimentWithScore; } });
Object.defineProperty(exports, "hasValidCodeSyntax", { enumerable: true, get: function () { return assertions_1.hasValidCodeSyntax; } });
Object.defineProperty(exports, "hasValidCodeSyntaxAsync", { enumerable: true, get: function () { return assertions_1.hasValidCodeSyntaxAsync; } });
Object.defineProperty(exports, "isValidEmail", { enumerable: true, get: function () { return assertions_1.isValidEmail; } });
Object.defineProperty(exports, "isValidURL", { enumerable: true, get: function () { return assertions_1.isValidURL; } });
Object.defineProperty(exports, "matchesPattern", { enumerable: true, get: function () { return assertions_1.matchesPattern; } });
Object.defineProperty(exports, "matchesSchema", { enumerable: true, get: function () { return assertions_1.matchesSchema; } });
Object.defineProperty(exports, "notContainsPII", { enumerable: true, get: function () { return assertions_1.notContainsPII; } });
Object.defineProperty(exports, "respondedWithinDuration", { enumerable: true, get: function () { return assertions_1.respondedWithinDuration; } });
Object.defineProperty(exports, "respondedWithinTime", { enumerable: true, get: function () { return assertions_1.respondedWithinTime; } });
Object.defineProperty(exports, "respondedWithinTimeSince", { enumerable: true, get: function () { return assertions_1.respondedWithinTimeSince; } });
Object.defineProperty(exports, "similarTo", { enumerable: true, get: function () { return assertions_1.similarTo; } });
Object.defineProperty(exports, "toSemanticallyContain", { enumerable: true, get: function () { return assertions_1.toSemanticallyContain; } });
Object.defineProperty(exports, "withinRange", { enumerable: true, get: function () { return assertions_1.withinRange; } });
// Legacy backward compat — SDKError is the old name for EvalGateError
var errors_2 = require("./errors");
Object.defineProperty(exports, "SDKError", { enumerable: true, get: function () { return errors_2.EvalGateError; } });
// Context propagation (Tier 2.9)
const context_1 = require("./context");
Object.defineProperty(exports, "createContext", { enumerable: true, get: function () { return context_1.createContext; } });
Object.defineProperty(exports, "ContextManager", { enumerable: true, get: function () { return context_1.EvalContext; } });
Object.defineProperty(exports, "getContext", { enumerable: true, get: function () { return context_1.getCurrentContext; } });
Object.defineProperty(exports, "withContext", { enumerable: true, get: function () { return context_1.withContext; } });
var context_2 = require("./runtime/context");
Object.defineProperty(exports, "cloneContext", { enumerable: true, get: function () { return context_2.cloneContext; } });
Object.defineProperty(exports, "mergeContexts", { enumerable: true, get: function () { return context_2.mergeContexts; } });
Object.defineProperty(exports, "validateContext", { enumerable: true, get: function () { return context_2.validateContext; } });
// LAYER 1: Runtime Foundation - NEW PROGRAMMING MODEL
var eval_1 = require("./runtime/eval");
Object.defineProperty(exports, "createEvalContext", { enumerable: true, get: function () { return eval_1.createContext; } });
Object.defineProperty(exports, "createResult", { enumerable: true, get: function () { return eval_1.createResult; } });
Object.defineProperty(exports, "defineEval", { enumerable: true, get: function () { return eval_1.defineEval; } });
Object.defineProperty(exports, "defineSuite", { enumerable: true, get: function () { return eval_1.defineSuite; } });
Object.defineProperty(exports, "evalai", { enumerable: true, get: function () { return eval_1.evalai; } });
Object.defineProperty(exports, "getFilteredSpecs", { enumerable: true, get: function () { return eval_1.getFilteredSpecs; } });
var executor_1 = require("./runtime/executor");
Object.defineProperty(exports, "createLocalExecutor", { enumerable: true, get: function () { return executor_1.createLocalExecutor; } });
Object.defineProperty(exports, "defaultLocalExecutor", { enumerable: true, get: function () { return executor_1.defaultLocalExecutor; } });
var registry_1 = require("./runtime/registry");
Object.defineProperty(exports, "createEvalRuntime", { enumerable: true, get: function () { return registry_1.createEvalRuntime; } });
Object.defineProperty(exports, "disposeActiveRuntime", { enumerable: true, get: function () { return registry_1.disposeActiveRuntime; } });
Object.defineProperty(exports, "getActiveRuntime", { enumerable: true, get: function () { return registry_1.getActiveRuntime; } });
Object.defineProperty(exports, "setActiveRuntime", { enumerable: true, get: function () { return registry_1.setActiveRuntime; } });
// Runtime errors
var types_1 = require("./runtime/types");
Object.defineProperty(exports, "EvalRuntimeError", { enumerable: true, get: function () { return types_1.EvalRuntimeError; } });
Object.defineProperty(exports, "RuntimeError", { enumerable: true, get: function () { return types_1.RuntimeError; } });
Object.defineProperty(exports, "SpecExecutionError", { enumerable: true, get: function () { return types_1.SpecExecutionError; } });
Object.defineProperty(exports, "SpecRegistrationError", { enumerable: true, get: function () { return types_1.SpecRegistrationError; } });
// Test suite builder (Tier 2.7) - BACKWARD COMPATIBILITY LAYER
var testing_1 = require("./testing");
Object.defineProperty(exports, "createTestSuite", { enumerable: true, get: function () { return testing_1.createTestSuite; } });
Object.defineProperty(exports, "TestSuite", { enumerable: true, get: function () { return testing_1.TestSuite; } });
// Snapshot testing (Tier 2.8)
const snapshot_1 = require("./snapshot");
Object.defineProperty(exports, "compareSnapshots", { enumerable: true, get: function () { return snapshot_1.compareSnapshots; } });
Object.defineProperty(exports, "compareWithSnapshot", { enumerable: true, get: function () { return snapshot_1.compareWithSnapshot; } });
Object.defineProperty(exports, "snapshot", { enumerable: true, get: function () { return snapshot_1.snapshot; } });
Object.defineProperty(exports, "saveSnapshot", { enumerable: true, get: function () { return snapshot_1.snapshot; } });
// Export/Import utilities (Tier 4.18)
const export_1 = require("./export");
Object.defineProperty(exports, "exportData", { enumerable: true, get: function () { return export_1.exportData; } });
Object.defineProperty(exports, "importData", { enumerable: true, get: function () { return export_1.importData; } });
// Note: RequestBatcher is for advanced users only
// Most users don't need this - batching is automatic
var batch_1 = require("./batch");
Object.defineProperty(exports, "RequestBatcher", { enumerable: true, get: function () { return batch_1.RequestBatcher; } });
// Performance optimization utilities (v1.3.0)
// Note: CacheTTL is for advanced users only
// Most users don't need this - caching is automatic
// RequestCache is intentionally NOT exported — it's an internal HTTP cache.
// Use CacheTTL to configure cache durations via client options.
var cache_1 = require("./cache");
Object.defineProperty(exports, "CacheTTL", { enumerable: true, get: function () { return cache_1.CacheTTL; } });
// CLI (programmatic use)
var check_1 = require("./cli/check");
Object.defineProperty(exports, "EXIT", { enumerable: true, get: function () { return check_1.EXIT; } });
Object.defineProperty(exports, "parseArgs", { enumerable: true, get: function () { return check_1.parseArgs; } });
Object.defineProperty(exports, "runCheck", { enumerable: true, get: function () { return check_1.runCheck; } });
var anthropic_1 = require("./integrations/anthropic");
Object.defineProperty(exports, "traceAnthropic", { enumerable: true, get: function () { return anthropic_1.traceAnthropic; } });
// Framework integrations (Tier 1.2)
var openai_1 = require("./integrations/openai");
Object.defineProperty(exports, "traceOpenAI", { enumerable: true, get: function () { return openai_1.traceOpenAI; } });
// OpenAI regression eval (local-first, no account required)
var openai_eval_1 = require("./integrations/openai-eval");
Object.defineProperty(exports, "openAIChatEval", { enumerable: true, get: function () { return openai_eval_1.openAIChatEval; } });
// Debug logger (Tier 4.17)
var logger_1 = require("./logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
// Vitest matcher: expect(await openAIChatEval(...)).toPassGate()
var matchers_1 = require("./matchers");
Object.defineProperty(exports, "extendExpectWithToPassGate", { enumerable: true, get: function () { return matchers_1.extendExpectWithToPassGate; } });
// OpenTelemetry export
var otel_1 = require("./otel");
Object.defineProperty(exports, "createOTelExporter", { enumerable: true, get: function () { return otel_1.createOTelExporter; } });
Object.defineProperty(exports, "OTelExporter", { enumerable: true, get: function () { return otel_1.OTelExporter; } });
var pagination_1 = require("./pagination");
Object.defineProperty(exports, "autoPaginate", { enumerable: true, get: function () { return pagination_1.autoPaginate; } });
Object.defineProperty(exports, "autoPaginateGenerator", { enumerable: true, get: function () { return pagination_1.autoPaginateGenerator; } });
Object.defineProperty(exports, "createPaginatedIterator", { enumerable: true, get: function () { return pagination_1.createPaginatedIterator; } });
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return pagination_1.decodeCursor; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return pagination_1.encodeCursor; } });
Object.defineProperty(exports, "PaginatedIterator", { enumerable: true, get: function () { return pagination_1.PaginatedIterator; } });
// Regression gate constants & types (v1.6.0)
var regression_1 = require("./regression");
Object.defineProperty(exports, "ARTIFACTS", { enumerable: true, get: function () { return regression_1.ARTIFACTS; } });
Object.defineProperty(exports, "GATE_CATEGORY", { enumerable: true, get: function () { return regression_1.GATE_CATEGORY; } });
Object.defineProperty(exports, "GATE_EXIT", { enumerable: true, get: function () { return regression_1.GATE_EXIT; } });
Object.defineProperty(exports, "REPORT_SCHEMA_VERSION", { enumerable: true, get: function () { return regression_1.REPORT_SCHEMA_VERSION; } });
// Streaming and batch processing (Tier 3.3)
// Use functions from ./streaming module instead of these deprecated exports
var streaming_1 = require("./streaming");
Object.defineProperty(exports, "batchProcess", { enumerable: true, get: function () { return streaming_1.batchProcess; } });
Object.defineProperty(exports, "batchRead", { enumerable: true, get: function () { return streaming_1.batchRead; } });
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return streaming_1.RateLimiter; } });
Object.defineProperty(exports, "streamEvaluation", { enumerable: true, get: function () { return streaming_1.streamEvaluation; } });
// New exports for v1.1.0
var types_2 = require("./types");
Object.defineProperty(exports, "EvaluationTemplates", { enumerable: true, get: function () { return types_2.EvaluationTemplates; } });
// Workflow tracing (Orchestration Layer)
var workflows_1 = require("./workflows");
Object.defineProperty(exports, "createWorkflowTracer", { enumerable: true, get: function () { return workflows_1.createWorkflowTracer; } });
Object.defineProperty(exports, "traceAutoGen", { enumerable: true, get: function () { return workflows_1.traceAutoGen; } });
Object.defineProperty(exports, "traceCrewAI", { enumerable: true, get: function () { return workflows_1.traceCrewAI; } });
// Framework integrations
Object.defineProperty(exports, "traceLangChainAgent", { enumerable: true, get: function () { return workflows_1.traceLangChainAgent; } });
Object.defineProperty(exports, "traceWorkflowStep", { enumerable: true, get: function () { return workflows_1.traceWorkflowStep; } });
Object.defineProperty(exports, "WorkflowTracer", { enumerable: true, get: function () { return workflows_1.WorkflowTracer; } });
// Default export for convenience
const client_2 = require("./client");
exports.default = client_2.AIEvalClient;
