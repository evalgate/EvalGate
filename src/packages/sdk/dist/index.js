"use strict";
/**
 * AI Evaluation Platform SDK
 *
 * Official TypeScript/JavaScript SDK for the AI Evaluation Platform.
 * Build confidence in your AI systems with comprehensive evaluation tools.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeCursor = exports.encodeCursor = exports.autoPaginate = exports.createPaginatedIterator = exports.PaginatedIterator = exports.CacheTTL = exports.RequestCache = exports.RateLimiter = exports.batchRead = exports.streamEvaluation = exports.batchProcess = exports.importData = exports.exportData = exports.compareSnapshots = exports.saveSnapshot = exports.compareWithSnapshot = exports.snapshot = exports.TestSuite = exports.createTestSuite = exports.ContextManager = exports.withContext = exports.getContext = exports.createContext = exports.hasValidCodeSyntax = exports.containsAllRequiredFields = exports.followsInstructions = exports.hasNoToxicity = exports.respondedWithinTime = exports.hasFactualAccuracy = exports.containsLanguage = exports.hasReadabilityScore = exports.matchesSchema = exports.hasNoHallucinations = exports.isValidURL = exports.isValidEmail = exports.withinRange = exports.similarTo = exports.hasSentiment = exports.notContainsPII = exports.containsJSON = exports.hasLength = exports.matchesPattern = exports.containsKeywords = exports.expect = exports.NetworkError = exports.ValidationError = exports.AuthenticationError = exports.RateLimitError = exports.EvalAIError = exports.AIEvalClient = void 0;
exports.EvaluationTemplates = exports.traceAnthropic = exports.traceOpenAI = exports.Logger = exports.RequestBatcher = void 0;
// Main SDK exports
var client_1 = require("./client");
Object.defineProperty(exports, "AIEvalClient", { enumerable: true, get: function () { return client_1.AIEvalClient; } });
// Enhanced error handling (Tier 1.5)
const errors_1 = require("./errors");
Object.defineProperty(exports, "EvalAIError", { enumerable: true, get: function () { return errors_1.EvalAIError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.SDKError; } });
// Enhanced assertions (Tier 1.3)
var assertions_1 = require("./assertions");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return assertions_1.expect; } });
Object.defineProperty(exports, "containsKeywords", { enumerable: true, get: function () { return assertions_1.containsKeywords; } });
Object.defineProperty(exports, "matchesPattern", { enumerable: true, get: function () { return assertions_1.matchesPattern; } });
Object.defineProperty(exports, "hasLength", { enumerable: true, get: function () { return assertions_1.hasLength; } });
Object.defineProperty(exports, "containsJSON", { enumerable: true, get: function () { return assertions_1.containsJSON; } });
Object.defineProperty(exports, "notContainsPII", { enumerable: true, get: function () { return assertions_1.notContainsPII; } });
Object.defineProperty(exports, "hasSentiment", { enumerable: true, get: function () { return assertions_1.hasSentiment; } });
Object.defineProperty(exports, "similarTo", { enumerable: true, get: function () { return assertions_1.similarTo; } });
Object.defineProperty(exports, "withinRange", { enumerable: true, get: function () { return assertions_1.withinRange; } });
Object.defineProperty(exports, "isValidEmail", { enumerable: true, get: function () { return assertions_1.isValidEmail; } });
Object.defineProperty(exports, "isValidURL", { enumerable: true, get: function () { return assertions_1.isValidURL; } });
Object.defineProperty(exports, "hasNoHallucinations", { enumerable: true, get: function () { return assertions_1.hasNoHallucinations; } });
Object.defineProperty(exports, "matchesSchema", { enumerable: true, get: function () { return assertions_1.matchesSchema; } });
Object.defineProperty(exports, "hasReadabilityScore", { enumerable: true, get: function () { return assertions_1.hasReadabilityScore; } });
Object.defineProperty(exports, "containsLanguage", { enumerable: true, get: function () { return assertions_1.containsLanguage; } });
Object.defineProperty(exports, "hasFactualAccuracy", { enumerable: true, get: function () { return assertions_1.hasFactualAccuracy; } });
Object.defineProperty(exports, "respondedWithinTime", { enumerable: true, get: function () { return assertions_1.respondedWithinTime; } });
Object.defineProperty(exports, "hasNoToxicity", { enumerable: true, get: function () { return assertions_1.hasNoToxicity; } });
Object.defineProperty(exports, "followsInstructions", { enumerable: true, get: function () { return assertions_1.followsInstructions; } });
Object.defineProperty(exports, "containsAllRequiredFields", { enumerable: true, get: function () { return assertions_1.containsAllRequiredFields; } });
Object.defineProperty(exports, "hasValidCodeSyntax", { enumerable: true, get: function () { return assertions_1.hasValidCodeSyntax; } });
// Context propagation (Tier 2.9)
const context_1 = require("./context");
Object.defineProperty(exports, "createContext", { enumerable: true, get: function () { return context_1.createContext; } });
Object.defineProperty(exports, "getContext", { enumerable: true, get: function () { return context_1.getCurrentContext; } });
Object.defineProperty(exports, "withContext", { enumerable: true, get: function () { return context_1.withContext; } });
Object.defineProperty(exports, "ContextManager", { enumerable: true, get: function () { return context_1.EvalContext; } });
// Test suite builder (Tier 2.7)
var testing_1 = require("./testing");
Object.defineProperty(exports, "createTestSuite", { enumerable: true, get: function () { return testing_1.createTestSuite; } });
Object.defineProperty(exports, "TestSuite", { enumerable: true, get: function () { return testing_1.TestSuite; } });
// Snapshot testing (Tier 2.8)
const snapshot_1 = require("./snapshot");
Object.defineProperty(exports, "snapshot", { enumerable: true, get: function () { return snapshot_1.snapshot; } });
Object.defineProperty(exports, "saveSnapshot", { enumerable: true, get: function () { return snapshot_1.snapshot; } });
Object.defineProperty(exports, "compareWithSnapshot", { enumerable: true, get: function () { return snapshot_1.compareWithSnapshot; } });
Object.defineProperty(exports, "compareSnapshots", { enumerable: true, get: function () { return snapshot_1.compareWithSnapshot; } });
// Export/Import utilities (Tier 4.18)
const export_1 = require("./export");
Object.defineProperty(exports, "exportData", { enumerable: true, get: function () { return export_1.exportData; } });
Object.defineProperty(exports, "importData", { enumerable: true, get: function () { return export_1.importData; } });
// Streaming and batch processing (Tier 3.3)
// Use functions from ./streaming module instead of these deprecated exports
var streaming_1 = require("./streaming");
Object.defineProperty(exports, "batchProcess", { enumerable: true, get: function () { return streaming_1.batchProcess; } });
Object.defineProperty(exports, "streamEvaluation", { enumerable: true, get: function () { return streaming_1.streamEvaluation; } });
Object.defineProperty(exports, "batchRead", { enumerable: true, get: function () { return streaming_1.batchRead; } });
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return streaming_1.RateLimiter; } });
// Performance optimization utilities (v1.3.0)
// Note: RequestCache and CacheTTL are for advanced users only
// Most users don't need these - caching is automatic
var cache_1 = require("./cache");
Object.defineProperty(exports, "RequestCache", { enumerable: true, get: function () { return cache_1.RequestCache; } });
Object.defineProperty(exports, "CacheTTL", { enumerable: true, get: function () { return cache_1.CacheTTL; } });
var pagination_1 = require("./pagination");
Object.defineProperty(exports, "PaginatedIterator", { enumerable: true, get: function () { return pagination_1.PaginatedIterator; } });
Object.defineProperty(exports, "createPaginatedIterator", { enumerable: true, get: function () { return pagination_1.createPaginatedIterator; } });
Object.defineProperty(exports, "autoPaginate", { enumerable: true, get: function () { return pagination_1.autoPaginate; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return pagination_1.encodeCursor; } });
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return pagination_1.decodeCursor; } });
// Note: RequestBatcher is for advanced users only
// Most users don't need this - batching is automatic
var batch_1 = require("./batch");
Object.defineProperty(exports, "RequestBatcher", { enumerable: true, get: function () { return batch_1.RequestBatcher; } });
// Debug logger (Tier 4.17)
var logger_1 = require("./logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
// Framework integrations (Tier 1.2)
var openai_1 = require("./integrations/openai");
Object.defineProperty(exports, "traceOpenAI", { enumerable: true, get: function () { return openai_1.traceOpenAI; } });
var anthropic_1 = require("./integrations/anthropic");
Object.defineProperty(exports, "traceAnthropic", { enumerable: true, get: function () { return anthropic_1.traceAnthropic; } });
// New exports for v1.1.0
var types_1 = require("./types");
Object.defineProperty(exports, "EvaluationTemplates", { enumerable: true, get: function () { return types_1.EvaluationTemplates; } });
// Default export for convenience
const client_2 = require("./client");
exports.default = client_2.AIEvalClient;
